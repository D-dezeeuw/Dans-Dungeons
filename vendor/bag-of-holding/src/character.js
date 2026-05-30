// === Character derivation ===
//
// The host owns the persistent character (the thing it saves to
// `.dnd.json`); the engine owns the math that turns it into a sheet.
// `deriveSheet` is the pure function in the middle: same record →
// same numbers, no I/O, no mutation. See docs/character-sheet.md for
// the field-by-field contract and the worked example.
//
// Why a separate module rather than a method on each record kind:
// derivation reads across registries the engine already builds
// (species, classes, backgrounds, feats, items) plus the XP
// proficiency-by-level table — keeping the cross-cutting code in one
// place makes the surface auditable and avoids parallel "compute mod"
// helpers drifting between class and item modules.
//
// The registries arrive as an injected `CharacterRegistries` view
// rather than the whole engine so this file stays import-light and
// stays testable without constructing a full engine in unit tests.

import { modFromScore } from './checks.js';
import { exhaustion as Exhaustion } from './conditions.js';

// === Constants ===
//
// Each table is exposed at module scope so a host can read the
// canonical mapping (skill list, average HP per die) without having
// to call `deriveSheet` first.

/**
 * The 18 SRD 5.2 skills and their governing ability. Frozen because
 * it's a closed list — a homebrew "Engineering" skill would need a
 * new entry, but that's the deliberate step into rule-modification
 * plugin territory, not an accident. Hosts iterate this when rendering
 * a skill table so the order and ability assignments stay in sync.
 */
export const SKILL_ABILITY = Object.freeze({
  'acrobatics':       'dex',
  'animal-handling':  'wis',
  'arcana':           'int',
  'athletics':        'str',
  'deception':        'cha',
  'history':          'int',
  'insight':          'wis',
  'intimidation':     'cha',
  'investigation':    'int',
  'medicine':         'wis',
  'nature':           'int',
  'perception':       'wis',
  'performance':      'cha',
  'persuasion':       'cha',
  'religion':         'int',
  'sleight-of-hand':  'dex',
  'stealth':          'dex',
  'survival':         'wis'
});

const ABILITIES = Object.freeze(['str', 'dex', 'con', 'int', 'wis', 'cha']);

/**
 * Conditions that drop walking speed to 0 per SRD 5.2. Restrained
 * adds disadvantage on top, but the loop's combat math will bake
 * that in with 0.7.0; what's unambiguous *now* — and visible on a
 * paper sheet — is speed.
 */
const SPEED_ZERO_CONDITIONS = Object.freeze([
  'grappled', 'paralyzed', 'petrified', 'restrained', 'stunned', 'unconscious'
]);

/**
 * Size multiplier on carrying capacity per SRD 5.2. Small was
 * normalised to ×1 in 5.2 (it was ×0.5 in 5.0), so a Halfling PC now
 * carries the same as a Human PC of equal STR. Tiny stays at ×0.5
 * for familiars and similar small-class creatures the host might
 * compute a sheet for.
 */
const SIZE_CAPACITY_MULTIPLIER = Object.freeze({
  tiny: 0.5, small: 1, medium: 1, large: 2, huge: 4, gargantuan: 8
});

/**
 * Average HP per level for levels 2+ on the standard hit dice. SRD
 * 5.2 uses `floor(hitDie / 2) + 1`, so d6 → 4, d8 → 5, d10 → 6,
 * d12 → 7. Kept as a lookup rather than recomputed inline so a
 * homebrew "d4 caster" plugin can extend it via a future rules knob
 * without us hunting for the magic formula.
 */
const AVG_HP_BY_DIE = Object.freeze({ 4: 3, 6: 4, 8: 5, 10: 6, 12: 7 });

// === Validation ===

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Throws on the first thing wrong with a record, with a pointer
 * sharp enough for a host developer to fix without grepping. Same
 * style as the plugin-contribution validator in engine.js — short
 * messages, one concern each, no schema lib.
 *
 * Why fail loud rather than coerce: a sheet built on a broken record
 * is a bug that hides until someone reads the AC and trusts it. The
 * engine refuses to derive over uncertain inputs.
 */
function validateRecord(record, registries) {
  if (!isPlainObject(record)) {
    throw new Error('CharacterRecord must be an object');
  }
  for (const field of ['id', 'name', 'speciesId', 'backgroundId', 'classId']) {
    if (typeof record[field] !== 'string' || record[field].length === 0) {
      throw new Error(`CharacterRecord.${field} must be a non-empty string`);
    }
  }
  if (!Number.isInteger(record.level) || record.level < 1) {
    throw new Error('CharacterRecord.level must be a positive integer');
  }
  if (!isPlainObject(record.abilityScores)) {
    throw new Error('CharacterRecord.abilityScores must be an object');
  }
  for (const ability of ABILITIES) {
    const value = record.abilityScores[ability];
    if (!Number.isInteger(value)) {
      throw new Error(`CharacterRecord.abilityScores.${ability} must be an integer`);
    }
  }
  if (!isPlainObject(record.equipment)) {
    throw new Error('CharacterRecord.equipment must be an object');
  }
  if (!Array.isArray(record.equipment.weaponIds)) {
    throw new Error('CharacterRecord.equipment.weaponIds must be an array');
  }
  if (!registries.species[record.speciesId]) {
    throw new Error(`CharacterRecord.speciesId '${record.speciesId}' not registered with engine`);
  }
  if (!registries.classes[record.classId]) {
    throw new Error(`CharacterRecord.classId '${record.classId}' not registered with engine`);
  }
  if (!registries.backgrounds[record.backgroundId]) {
    throw new Error(`CharacterRecord.backgroundId '${record.backgroundId}' not registered with engine`);
  }
  // Equipment id lookups: surface the slot AND the offending id so
  // the host's UI can highlight the right row.
  if (record.equipment.armorId && !registries.items[record.equipment.armorId]) {
    throw new Error(`CharacterRecord.equipment.armorId '${record.equipment.armorId}' not registered with engine`);
  }
  if (record.equipment.shieldId && !registries.items[record.equipment.shieldId]) {
    throw new Error(`CharacterRecord.equipment.shieldId '${record.equipment.shieldId}' not registered with engine`);
  }
  for (const weaponId of record.equipment.weaponIds) {
    if (!registries.items[weaponId]) {
      throw new Error(`CharacterRecord.equipment.weaponIds entry '${weaponId}' not registered with engine`);
    }
  }
}

// === Sub-derivers ===
//
// Each one consumes the validated record (and whatever registry view
// it needs) and returns a plain piece of the sheet. They're internal
// rather than exported because the public contract is the sheet as a
// whole — callers re-derive the whole thing, the engine doesn't
// promise stable signatures for the parts.

/**
 * Apply background bumps on top of the base scores and return both
 * the final scores and their mods. The bump distribution defaults to
 * +1 to each of the three listed abilities — the always-valid even
 * split per SRD 5.2 (the {+2, +1, 0} split is also valid but the
 * player has to opt in by setting `abilityScoreBumps` explicitly).
 *
 * Why default rather than throw: most level-1 PCs leave the default
 * alone, and crashing on "you forgot to write `{ str:1, dex:1, con:1 }`"
 * would be hostile to hosts that auto-generate records.
 */
function deriveAbilities(record, background) {
  const final = { ...record.abilityScores };
  const explicitBumps = record.abilityScoreBumps;
  if (explicitBumps) {
    for (const ability of ABILITIES) {
      final[ability] += explicitBumps[ability] ?? 0;
    }
  } else {
    for (const ability of background.abilityScores) {
      final[ability] += 1;
    }
  }
  const mod = {};
  for (const ability of ABILITIES) {
    mod[ability] = modFromScore(final[ability]);
  }
  return { final, mod };
}

/**
 * Max HP from class hit die, CON mod per level, and any explicit
 * per-level rolls. The SRD convention is "L1 = max hit die"; if the
 * host wants to homebrew rolled L1, it can pass `hpRolled[0]`
 * explicitly. Levels 2+ default to the canonical average
 * (`floor(d/2) + 1`) when no roll is recorded.
 *
 * Why not just take a final number from the host: the breakdown
 * matters when the player changes CON (a magic item, a temporary
 * effect) — recomputing from primitives is cheap; reconciling a
 * cached total with mid-flight changes is not.
 */
function deriveMaxHp(record, classDef, conMod) {
  const hitDie = classDef.hitDie;
  const rolled = Array.isArray(record.hpRolled) ? record.hpRolled : [];
  const avgPerLevel = AVG_HP_BY_DIE[hitDie] ?? (Math.floor(hitDie / 2) + 1);

  // L1: max die unless the host explicitly rolled otherwise.
  const l1 = (rolled[0] ?? hitDie) + conMod;

  // L2..level: rolled if present, otherwise average. CON mod added
  // each level on top.
  let acc = l1;
  for (let level = 2; level <= record.level; level += 1) {
    const baseRoll = rolled[level - 1] ?? avgPerLevel;
    acc += baseRoll + conMod;
  }
  return acc;
}

/**
 * AC with its breakdown. Encodes the three SRD armor cases:
 *   1. Unarmored → 10 + DEX. No class-feature alternatives modelled
 *      yet (Monk's Unarmored Defense, Barbarian's etc. land with
 *      0.6.0); a homebrew armor record with `acFormula` can be a
 *      future knob.
 *   2. Light/medium armor (`addsDex: true`, optional `maxDex`) →
 *      armor.ac + min(DEX, maxDex ?? ∞).
 *   3. Heavy armor (`addsDex: false` or unset on a record with an
 *      `ac` value) → armor.ac, no DEX.
 *
 * Shield AC is additive across all three. The `misc` bucket is the
 * landing spot for feats/spells (Shield, Defense fighting style) once
 * 0.3 hooks let them participate.
 */
function deriveAc(record, items, dexMod) {
  const armor = record.equipment.armorId ? items[record.equipment.armorId] : null;
  const shield = record.equipment.shieldId ? items[record.equipment.shieldId] : null;

  let armorAc = 10;
  let dexContribution = dexMod;
  if (armor) {
    armorAc = armor.ac ?? 10;
    if (armor.addsDex) {
      dexContribution = armor.maxDex !== undefined
        ? Math.min(dexMod, armor.maxDex)
        : dexMod;
    } else {
      dexContribution = 0;
    }
  }
  const shieldAc = shield?.acBonus ?? 0;
  const misc = 0;
  return {
    value: armorAc + dexContribution + shieldAc + misc,
    breakdown: { armor: armorAc, shield: shieldAc, dex: dexContribution, misc }
  };
}

/**
 * Initiative is DEX mod plus proficiency-bonus addition when the
 * character has Alert (SRD 5.2 grants proficiency in Initiative
 * rather than a flat +5). Other initiative-altering feats / class
 * features can land here later — the breakdown of "what added what"
 * is deliberately not surfaced because initiative is a single roll;
 * AC and HP need a breakdown for UI rendering, initiative doesn't.
 */
function deriveInitiative(allFeats, profBonus, dexMod) {
  const alert = allFeats.find((f) => f.id === 'alert');
  return dexMod + (alert ? profBonus : 0);
}

/**
 * Walking speed after exhaustion and movement-cancelling conditions.
 * Per SRD 5.2, Exhaustion subtracts 5 ft per level (handled by
 * `Conditions.exhaustion.speedPenalty`). Grappled / Paralyzed /
 * Petrified / Restrained / Stunned / Unconscious all set speed to 0
 * — we hard-zero on any of them so a paralyzed PC's sheet doesn't
 * misleadingly show "25 ft (exhausted from 30)".
 */
function deriveSpeed(species, conditions, exhaustionLevel) {
  if (conditions.some((c) => SPEED_ZERO_CONDITIONS.includes(c))) {
    return { walk: 0 };
  }
  const penalty = Exhaustion.speedPenalty({ exhaustion: exhaustionLevel });
  return { walk: Math.max(0, species.speed - penalty) };
}

/**
 * One save line per ability. Proficiency is the union of the class's
 * `savingThrowProficiencies` and any explicit `record.proficiencies.saves`
 * — the host wires multiclass / feat-granted saves through the latter.
 */
function deriveSaves(classDef, extraSaves, profBonus, abilityMods) {
  const classSaves = new Set(classDef.savingThrowProficiencies ?? []);
  const extraSet = new Set(extraSaves ?? []);
  const saves = {};
  for (const ability of ABILITIES) {
    const proficient = classSaves.has(ability) || extraSet.has(ability);
    saves[ability] = {
      mod: abilityMods[ability] + (proficient ? profBonus : 0),
      proficient
    };
  }
  return saves;
}

/**
 * Per-skill lines. Proficiency stacks from background +
 * `record.proficiencies.skills` (class skills aren't in our class
 * records yet — see docs/character-sheet.md § what deriveSheet does
 * not do). Expertise doubles the proficiency portion *only* if the
 * skill is also proficient; expertise without proficiency is a
 * malformed record but we tolerate it by treating expertise as a no-op
 * rather than throwing — a host editor mid-edit shouldn't crash on a
 * half-written record.
 */
function deriveSkills(background, extraSkills, expertise, profBonus, abilityMods) {
  const proficientSet = new Set([
    ...(background.skillProficiencies ?? []),
    ...(extraSkills ?? [])
  ]);
  const expertiseSet = new Set(expertise ?? []);
  const skills = {};
  for (const [skillId, ability] of Object.entries(SKILL_ABILITY)) {
    const proficient = proficientSet.has(skillId);
    const isExpert = proficient && expertiseSet.has(skillId);
    const profPortion = isExpert ? profBonus * 2 : (proficient ? profBonus : 0);
    skills[skillId] = {
      ability,
      mod: abilityMods[ability] + profPortion,
      proficient,
      expertise: isExpert
    };
  }
  return skills;
}

/**
 * One attack line per equipped weapon. Ability used:
 *   - Ranged → DEX.
 *   - Finesse → max(STR, DEX) mod (the player's better arm).
 *   - Otherwise → STR.
 * Proficiency is assumed true for now because class weapon
 * proficiencies aren't modelled yet (see roadmap 0.6.0). When that
 * lands, the assumption becomes a registry lookup.
 *
 * The mastery property passes through verbatim; whether the
 * character can actually use it is gated by class features
 * (`weaponMasterySlots`) which the loop tracks in actor state, not on
 * the sheet — surfacing the property here lets the UI tag the row
 * either way ("sap (locked)" vs "sap").
 */
function deriveAttacks(record, items, profBonus, abilityMods) {
  const attacks = [];
  for (const weaponId of record.equipment.weaponIds) {
    const weapon = items[weaponId];
    const properties = weapon.properties ?? [];
    const isRanged = properties.includes('ranged');
    const isFinesse = properties.includes('finesse');
    let abilityMod;
    if (isRanged) {
      abilityMod = abilityMods.dex;
    } else if (isFinesse) {
      abilityMod = Math.max(abilityMods.str, abilityMods.dex);
    } else {
      abilityMod = abilityMods.str;
    }
    attacks.push({
      weaponId,
      name: weapon.name,
      attackBonus: abilityMod + profBonus,
      damageDice: weapon.damage ?? '0',
      damageMod: abilityMod,
      damageType: weapon.damageType,
      masteryProperty: weapon.mastery,
      // Clone so deep-freezing the sheet later can't reach back and
      // freeze the item registry's mutable properties array.
      properties: [...properties]
    });
  }
  return attacks;
}

/**
 * Spellcasting block for caster classes. SRD 5.2 spell-attack and
 * save-DC formulae are the canonical ones (8 + prof + ability mod for
 * DC, prof + ability mod for attack). Non-casters return `null`
 * rather than an empty object so the UI can branch on `=== null`.
 *
 * Slot tracking is deferred to 0.5.0 — what we *can* produce today
 * is the DC and attack bonus, which the loop needs every time a
 * caster targets something.
 */
function deriveSpellcasting(classDef, profBonus, abilityMods) {
  const sc = classDef.spellcasting;
  if (!sc) return null;
  const abilityMod = abilityMods[sc.ability];
  return {
    ability: sc.ability,
    attackBonus: profBonus + abilityMod,
    saveDC: 8 + profBonus + abilityMod
  };
}

/**
 * Resolve the full feat list: the background's origin feat plus
 * anything the record adds. Origin-feat duplication (record explicitly
 * lists the background's feat) is collapsed by id.
 *
 * Surfaced as a helper because both `deriveInitiative` and any future
 * feat-aware deriver (Tough's HP bump, Defensive Duelist's AC) need
 * the same accumulated list and we don't want them to diverge on
 * what counts as "the character's feats".
 */
function resolveFeats(record, background) {
  const fromRecord = Array.isArray(record.feats) ? record.feats : [];
  const seen = new Map();
  for (const feat of [background.originFeat, ...fromRecord]) {
    seen.set(feat.id, feat);
  }
  return [...seen.values()];
}

// === Public surface ===

/**
 * Turn a host-owned character record into a frozen sheet of every
 * derivable number. Pure: same record + same registry view → byte-
 * identical output. Throws on malformed input rather than coercing,
 * because every consumer of the sheet trusts it without a second
 * check — a silently-wrong AC is a much worse failure mode than a
 * loud rejection at derive time.
 *
 * The returned object is deeply frozen so a caller that tries to
 * patch a value (rather than updating the record and re-deriving)
 * gets a TypeError in strict mode rather than a sheet that drifts
 * from its source.
 *
 * @param {object} record       A CharacterRecord (see docs/character-sheet.md).
 * @param {object} registries   A CharacterRegistries view — typically
 *                              `engine` itself, since an engine
 *                              satisfies the interface structurally.
 * @returns {object}            A frozen DerivedSheet.
 */
export function deriveSheet(record, registries) {
  validateRecord(record, registries);

  const species = registries.species[record.speciesId];
  const classDef = registries.classes[record.classId];
  const background = registries.backgrounds[record.backgroundId];
  const items = registries.items;

  const profBonus = registries.XP.PROFICIENCY_BY_LEVEL[record.level]
    ?? Math.ceil(record.level / 4) + 1;   // graceful fallback past tier 1

  const { final: abilityFinal, mod: abilityMods } = deriveAbilities(record, background);
  const allFeats = resolveFeats(record, background);
  const conditions = Array.isArray(record.conditions) ? record.conditions : [];
  const exhaustionLevel = Exhaustion.level({ exhaustion: record.exhaustion });

  const hp = { max: deriveMaxHp(record, classDef, abilityMods.con) };
  const ac = deriveAc(record, items, abilityMods.dex);
  const initiative = deriveInitiative(allFeats, profBonus, abilityMods.dex);
  const speed = deriveSpeed(species, conditions, exhaustionLevel);
  const saves = deriveSaves(classDef, record.proficiencies?.saves, profBonus, abilityMods);
  const skills = deriveSkills(
    background,
    record.proficiencies?.skills,
    record.proficiencies?.expertise,
    profBonus,
    abilityMods
  );
  const attacks = deriveAttacks(record, items, profBonus, abilityMods);
  const spellcasting = deriveSpellcasting(classDef, profBonus, abilityMods);

  const passives = {
    perception:    10 + skills.perception.mod,
    insight:       10 + skills.insight.mod,
    investigation: 10 + skills.investigation.mod
  };

  const sizeMultiplier = SIZE_CAPACITY_MULTIPLIER[species.size] ?? 1;
  const capacity = Math.round(abilityFinal.str * 15 * sizeMultiplier);
  const carryingCapacity = { capacity, push: capacity * 2, lift: capacity * 2 };

  // Omit subclassId from meta when absent so a serialised sheet
  // doesn't carry `subclassId: undefined` (which round-trips as a
  // missing key under JSON.parse / JSON.stringify and would diff
  // unstably against pinned fixtures).
  const meta = {
    source: 'bag-of-holding/character@1',
    speciesId: record.speciesId,
    classId: record.classId,
    level: record.level
  };
  if (record.subclassId !== undefined) {
    meta.subclassId = record.subclassId;
  }

  const sheet = {
    meta,
    abilityScores: { final: abilityFinal, mod: abilityMods },
    proficiencyBonus: profBonus,
    hp,
    ac,
    initiative,
    speed,
    saves,
    skills,
    attacks,
    spellcasting,
    passives,
    carryingCapacity,
    activeEffects: {
      conditions: [...conditions],
      exhaustion: exhaustionLevel
    }
  };

  return deepFreeze(sheet);
}

/**
 * Freeze every nested object so a sheet can't be patched in place.
 * Implemented inline rather than depending on a "deep-freeze" lib
 * because zero deps is the engine's headline; the recursion is
 * cheap, the sheet is shallow, and a fresh sheet never contains
 * already-frozen sub-objects, so we don't need a cycle / re-freeze
 * guard.
 *
 * Called only on freshly-built sheet roots, so the entry value is
 * always an object — no top-level null/primitive guard needed.
 */
function deepFreeze(value) {
  for (const key of Object.keys(value)) {
    const child = value[key];
    if (child !== null && typeof child === 'object') {
      deepFreeze(child);
    }
  }
  return Object.freeze(value);
}
