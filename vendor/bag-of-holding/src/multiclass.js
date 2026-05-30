// === Multiclassing (SRD 5.2 § Character Creation — Multiclassing,
// since 1.12.0) ===
//
// A multiclass character's record carries either:
//   - `record.classId` + `record.level`        — legacy single-class
//   - `record.classes: { fighter: 3, rogue: 2 }` — multiclass map
// The engine reads both forms via the helpers below. `deriveSheet`
// continues to honour the legacy shape; consumers that want the
// multiclass features call `totalLevel` / `casterLevel` /
// `canMulticlassInto` directly.

import { modFromScore } from './checks.js';

/**
 * SRD § Multiclassing — Prerequisites table. Map of classId → list
 * of ability score minimums (any one of which qualifies for that
 * class, except where two abilities are listed both being required).
 * The 5e/2024 spec couples STR-or-DEX for Fighter and Ranger; the
 * shipped table treats those as alternatives via the `or` semantics
 * a host can read off the `requireAny` field. For classes with a
 * single requirement, `requireAll` is used.
 *
 * Cleric and Druid only require WIS. Wizard only INT. Etc.
 */
export const MULTICLASS_PREREQS = Object.freeze({
  barbarian: { requireAll: { str: 13 } },
  bard:      { requireAll: { cha: 13 } },
  cleric:    { requireAll: { wis: 13 } },
  druid:     { requireAll: { wis: 13 } },
  fighter:   { requireAny: { str: 13, dex: 13 } },
  monk:      { requireAll: { dex: 13, wis: 13 } },
  paladin:   { requireAll: { str: 13, cha: 13 } },
  ranger:    { requireAll: { dex: 13, wis: 13 } },
  rogue:     { requireAll: { dex: 13 } },
  sorcerer:  { requireAll: { cha: 13 } },
  warlock:   { requireAll: { cha: 13 } },
  wizard:    { requireAll: { int: 13 } }
});

/**
 * Caster progression weight per class for the multiclass spell-slot
 * formula. SRD § Multiclassing — Spellcaster: Bard, Cleric, Druid,
 * Sorcerer, Wizard count fully; Paladin and Ranger count half
 * (rounded down); Eldritch Knight / Arcane Trickster count a third
 * (rounded down). Warlock's Pact Magic is tracked separately —
 * Warlock levels contribute nothing to the shared caster level.
 */
export const CASTER_WEIGHT = Object.freeze({
  bard: 1, cleric: 1, druid: 1, sorcerer: 1, wizard: 1,
  paladin: 0.5, ranger: 0.5,
  // Warlock is intentionally absent — Pact Magic is its own track.
  // Subclass-specific third-casters (eldritch-knight, arcane-trickster)
  // can be opted into via a custom CASTER_WEIGHT map per engine.
});

/**
 * Total character level summed across all classes. Accepts either
 * the legacy `classId + level` form or the multiclass `classes` map.
 */
export function totalLevel(record) {
  if (record.classes && typeof record.classes === 'object') {
    let sum = 0;
    for (const lvl of Object.values(record.classes)) sum += lvl;
    return sum;
  }
  return record.level ?? 0;
}

/**
 * Multiclass caster level per the SRD formula. Returns an integer
 * (floor of the weighted sum). The shared caster level drives slot
 * progression for the full-/half-/third-caster mix.
 *
 * Single-class records use the simpler path: weight × level (a
 * non-caster fighter has weight 0 → caster level 0).
 */
export function casterLevel(record, weights = CASTER_WEIGHT) {
  if (record.classes && typeof record.classes === 'object') {
    let sum = 0;
    for (const [classId, lvl] of Object.entries(record.classes)) {
      const w = weights[classId] ?? 0;
      sum += w * lvl;
    }
    return Math.floor(sum);
  }
  const w = weights[record.classId] ?? 0;
  return Math.floor(w * (record.level ?? 0));
}

/**
 * Validate a candidate multiclass pick. SRD § Multiclassing —
 * Prerequisites: the actor must meet BOTH the current class's and
 * the new class's ability prereqs.
 *
 * Returns `{ ok, reason? }`. `reason` cites the failing ability.
 */
export function canMulticlassInto(record, newClassId, prereqs = MULTICLASS_PREREQS) {
  if (!newClassId) return { ok: false, reason: 'newClassId required' };
  const newReq = prereqs[newClassId];
  if (!newReq) return { ok: false, reason: `unknown class: ${newClassId}` };
  // The current-class side: enforce prereq for *every* class the
  // character already has. (The SRD wording: "to qualify for a new
  // class, you must meet the ability score prerequisites for both
  // your current class and your new one"; with three+ existing
  // classes, prereqs for every prior class must also be met.)
  const currentClassIds = record.classes
    ? Object.keys(record.classes)
    : (record.classId ? [record.classId] : []);
  const scores = record.abilityScores ?? {};
  const meetsReq = (req) => {
    if (req.requireAll) {
      for (const [ability, minimum] of Object.entries(req.requireAll)) {
        if ((scores[ability] ?? 10) < minimum) {
          return { ok: false, reason: `requires ${ability.toUpperCase()} ${minimum}+` };
        }
      }
    }
    if (req.requireAny) {
      const passes = Object.entries(req.requireAny).some(
        ([ability, minimum]) => (scores[ability] ?? 10) >= minimum
      );
      if (!passes) {
        const abilities = Object.keys(req.requireAny).map((a) => a.toUpperCase()).join(' or ');
        const minimum = Object.values(req.requireAny)[0];
        return { ok: false, reason: `requires ${abilities} ${minimum}+` };
      }
    }
    return { ok: true };
  };
  for (const id of currentClassIds) {
    const req = prereqs[id];
    if (!req) continue;     // unknown class on the existing side is the host's bug, not the picker's
    const check = meetsReq(req);
    if (!check.ok) return check;
  }
  const newCheck = meetsReq(newReq);
  if (!newCheck.ok) return newCheck;
  return { ok: true };
}

// === Languages + tools (SRD § Equipment — Tools, § Character
// Creation — Languages) ===

/**
 * Read the actor's known languages. Defensive against missing
 * field. Returns a frozen list so the host can't accidentally
 * mutate it.
 */
export function languages(record) {
  return Object.freeze([...(Array.isArray(record.languages) ? record.languages : [])]);
}

/** Predicate: does the actor know the named language? */
export function knowsLanguage(record, lang) {
  return Array.isArray(record.languages) && record.languages.includes(lang);
}

/** Read the actor's tool proficiencies. */
export function tools(record) {
  return Object.freeze([...(Array.isArray(record.tools) ? record.tools : [])]);
}

/**
 * Predicate: is the actor proficient with the named tool? Used by
 * a future `Checks.toolCheck` helper or host-side ad-hoc tool
 * advantage logic.
 */
export function isProficientWithTool(record, tool) {
  return Array.isArray(record.tools) && record.tools.includes(tool);
}
