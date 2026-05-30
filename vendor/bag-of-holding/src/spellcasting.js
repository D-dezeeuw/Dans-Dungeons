// === Spellcasting mechanics ===
//
// Spell *records* shipped at 0.0.0; spell *mechanics* land here.
// What the engine handles:
//   - Slot tables per casting class, per level.
//   - Slot consumption with refund-on-cancel semantics.
//   - Rest semantics (long rest → all back; short rest → Warlock
//     pact slots).
//   - Concentration (one active spell, CON save on damage, drops
//     when broken or replaced).
//   - Cantrip scaling tier breakpoints (5/11/17).
//   - Preparation lists for the prep-casting classes.
//   - Reaction-cast: the host calls `castReaction(spell, caster)`
//     which fires the `beforeAttack`/`afterDamage` hooks the spell
//     declares; the actual hook plumbing lives in engine.js.
//
// Why a new module: it has its own opinions (slot tables, rest
// semantics) and pulls in nothing else. Folding it into engine.js
// would inflate the factory; folding it into spells.js would mix
// data and mechanics.

// === Slot tables ===
//
// SRD 5.2 full-caster table (Wizard, Cleric, Druid, Bard, Sorcerer).
// `null` cells mean "no slots at this level". Index = caster level,
// inner array index = spell level (1-indexed; index 0 is unused so
// the inner indices line up with spell levels for readability).
//
// We store this as a 2D table rather than a per-class hand-roll
// because every full caster shares it; subclass exceptions (e.g.
// Eldritch Knight's third-caster progression) live on the class def.

/**
 * Slot count for a full caster at `(casterLevel, spellLevel)`.
 * Returns 0 when the caster doesn't have access yet. Throws on
 * out-of-range inputs so a typo'd lookup is loud at the call site.
 */
export function fullCasterSlots(casterLevel, spellLevel) {
  if (!Number.isInteger(casterLevel) || casterLevel < 1 || casterLevel > 20) {
    throw new Error(`casterLevel out of range: ${casterLevel}`);
  }
  if (!Number.isInteger(spellLevel) || spellLevel < 1 || spellLevel > 9) {
    throw new Error(`spellLevel out of range: ${spellLevel}`);
  }
  return FULL_CASTER_TABLE[casterLevel - 1][spellLevel];
}

// Rows are caster levels 1..20. Inner indices 1..9 are spell
// levels; index 0 is a placeholder so the inner indices line up
// with the spell level being asked for.
const FULL_CASTER_TABLE = [
  /* L1  */ [0, 2, 0, 0, 0, 0, 0, 0, 0, 0],
  /* L2  */ [0, 3, 0, 0, 0, 0, 0, 0, 0, 0],
  /* L3  */ [0, 4, 2, 0, 0, 0, 0, 0, 0, 0],
  /* L4  */ [0, 4, 3, 0, 0, 0, 0, 0, 0, 0],
  /* L5  */ [0, 4, 3, 2, 0, 0, 0, 0, 0, 0],
  /* L6  */ [0, 4, 3, 3, 0, 0, 0, 0, 0, 0],
  /* L7  */ [0, 4, 3, 3, 1, 0, 0, 0, 0, 0],
  /* L8  */ [0, 4, 3, 3, 2, 0, 0, 0, 0, 0],
  /* L9  */ [0, 4, 3, 3, 3, 1, 0, 0, 0, 0],
  /* L10 */ [0, 4, 3, 3, 3, 2, 0, 0, 0, 0],
  /* L11 */ [0, 4, 3, 3, 3, 2, 1, 0, 0, 0],
  /* L12 */ [0, 4, 3, 3, 3, 2, 1, 0, 0, 0],
  /* L13 */ [0, 4, 3, 3, 3, 2, 1, 1, 0, 0],
  /* L14 */ [0, 4, 3, 3, 3, 2, 1, 1, 0, 0],
  /* L15 */ [0, 4, 3, 3, 3, 2, 1, 1, 1, 0],
  /* L16 */ [0, 4, 3, 3, 3, 2, 1, 1, 1, 0],
  /* L17 */ [0, 4, 3, 3, 3, 2, 1, 1, 1, 1],
  /* L18 */ [0, 4, 3, 3, 3, 3, 1, 1, 1, 1],
  /* L19 */ [0, 4, 3, 3, 3, 3, 2, 1, 1, 1],
  /* L20 */ [0, 4, 3, 3, 3, 3, 2, 2, 1, 1]
];

/**
 * Half-caster slot table (Paladin, Ranger). Per SRD 5.2 they cast
 * starting at level 2; below that, returns 0.
 */
export function halfCasterSlots(casterLevel, spellLevel) {
  if (!Number.isInteger(casterLevel) || casterLevel < 1 || casterLevel > 20) {
    throw new Error(`casterLevel out of range: ${casterLevel}`);
  }
  if (!Number.isInteger(spellLevel) || spellLevel < 1 || spellLevel > 5) {
    throw new Error(`spellLevel out of range for half-caster: ${spellLevel}`);
  }
  if (casterLevel < 2) return 0;
  return HALF_CASTER_TABLE[casterLevel - 2][spellLevel];
}

// Rows are caster levels 2..20 (level 1 has no slots).
const HALF_CASTER_TABLE = [
  /* L2  */ [0, 2, 0, 0, 0, 0],
  /* L3  */ [0, 3, 0, 0, 0, 0],
  /* L4  */ [0, 3, 0, 0, 0, 0],
  /* L5  */ [0, 4, 2, 0, 0, 0],
  /* L6  */ [0, 4, 2, 0, 0, 0],
  /* L7  */ [0, 4, 3, 0, 0, 0],
  /* L8  */ [0, 4, 3, 0, 0, 0],
  /* L9  */ [0, 4, 3, 2, 0, 0],
  /* L10 */ [0, 4, 3, 2, 0, 0],
  /* L11 */ [0, 4, 3, 3, 0, 0],
  /* L12 */ [0, 4, 3, 3, 0, 0],
  /* L13 */ [0, 4, 3, 3, 1, 0],
  /* L14 */ [0, 4, 3, 3, 1, 0],
  /* L15 */ [0, 4, 3, 3, 2, 0],
  /* L16 */ [0, 4, 3, 3, 2, 0],
  /* L17 */ [0, 4, 3, 3, 3, 1],
  /* L18 */ [0, 4, 3, 3, 3, 1],
  /* L19 */ [0, 4, 3, 3, 3, 2],
  /* L20 */ [0, 4, 3, 3, 3, 2]
];

/**
 * Warlock Pact Magic slots — small count, but they refresh on a
 * short rest and are always cast at a fixed level keyed to caster
 * level. Returns `{ count, level }` so the host can drive the slot
 * bar without a separate mechanism.
 */
export function warlockPactSlots(casterLevel) {
  if (!Number.isInteger(casterLevel) || casterLevel < 1 || casterLevel > 20) {
    throw new Error(`casterLevel out of range: ${casterLevel}`);
  }
  const table = [
    /*  L1 */ { count: 1, level: 1 },
    /*  L2 */ { count: 2, level: 1 },
    /*  L3 */ { count: 2, level: 2 },
    /*  L4 */ { count: 2, level: 2 },
    /*  L5 */ { count: 2, level: 3 },
    /*  L6 */ { count: 2, level: 3 },
    /*  L7 */ { count: 2, level: 4 },
    /*  L8 */ { count: 2, level: 4 },
    /*  L9 */ { count: 2, level: 5 },
    /* L10 */ { count: 2, level: 5 },
    /* L11 */ { count: 3, level: 5 },
    /* L12 */ { count: 3, level: 5 },
    /* L13 */ { count: 3, level: 5 },
    /* L14 */ { count: 3, level: 5 },
    /* L15 */ { count: 3, level: 5 },
    /* L16 */ { count: 3, level: 5 },
    /* L17 */ { count: 4, level: 5 },
    /* L18 */ { count: 4, level: 5 },
    /* L19 */ { count: 4, level: 5 },
    /* L20 */ { count: 4, level: 5 }
  ];
  return table[casterLevel - 1];
}

// === Slot management ===
//
// Slot state is per-actor and lives in the host's character record
// (under `record.spells.slots`). The functions below are pure: take
// a slot array, return a new one.

/**
 * Build a fresh slot array for a class + level. The result is the
 * starting state for a new character or a long-rested one — every
 * slot at full capacity.
 *
 * `progression`:
 *   - `'full'`   → uses fullCasterSlots
 *   - `'half'`   → uses halfCasterSlots
 *   - `'warlock'` → pact slots
 *   - `'none'`   → returns empty array (Fighter, Rogue, etc.)
 */
export function freshSlots(progression, casterLevel) {
  if (progression === 'none') return [];
  const out = [];
  if (progression === 'warlock') {
    const { count, level } = warlockPactSlots(casterLevel);
    out.push({ level, used: 0, max: count, source: 'pact' });
    return out;
  }
  const slotFn = progression === 'full' ? fullCasterSlots : halfCasterSlots;
  const maxLevel = progression === 'full' ? 9 : 5;
  for (let spellLevel = 1; spellLevel <= maxLevel; spellLevel++) {
    const max = slotFn(casterLevel, spellLevel);
    if (max > 0) out.push({ level: spellLevel, used: 0, max });
  }
  return out;
}

/**
 * Consume one slot of `level`. Auto-upcasts: if the requested level
 * has no slots left, consumes the next-higher slot that does. SRD
 * cantrips don't consume slots — the host should special-case
 * `spell.level === 0` and skip this call.
 *
 * Returns `{ ok: true, slots, levelCast }` on success — `levelCast`
 * may be higher than `level` if the engine upcast — or
 * `{ ok: false, reason }` if no slot is available.
 */
export function consumeSlot(slots, level) {
  if (!Array.isArray(slots)) throw new Error('slots must be an array');
  if (!Number.isInteger(level) || level < 1) {
    throw new Error('level must be a positive integer');
  }
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (s.level >= level && s.used < s.max) {
      const next = slots.slice();
      next[i] = { ...s, used: s.used + 1 };
      return { ok: true, slots: next, levelCast: s.level };
    }
  }
  return { ok: false, reason: `no slot of level ${level}+ available` };
}

/**
 * Refund a slot. Used by the host when a spell is interrupted
 * before resolution (Counterspell, target dies mid-cast). Idempotent:
 * if `used` is already 0, returns the slots unchanged.
 */
export function refundSlot(slots, level) {
  const i = slots.findIndex((s) => s.level === level);
  if (i === -1) return slots;
  if (slots[i].used === 0) return slots;
  const next = slots.slice();
  next[i] = { ...slots[i], used: slots[i].used - 1 };
  return next;
}

/**
 * Long rest: every slot refills, including Warlock pact slots
 * (technically Warlock refreshes on short rest too — this is the
 * conservative "long rest refreshes everything" behaviour). Returns
 * a new array.
 */
export function longRest(slots) {
  return slots.map((s) => ({ ...s, used: 0 }));
}

/**
 * Short rest: refreshes only `source: 'pact'` slots (Warlock).
 * Other slots are untouched.
 */
export function shortRest(slots) {
  return slots.map((s) => s.source === 'pact' ? { ...s, used: 0 } : s);
}

// === Concentration ===
//
// One concentration spell at a time per caster. Damage triggers a
// CON save (DC = max(10, floor(damage/2))). The state is a small
// `{ spellId, level }` object stored on the actor; we expose
// pure helpers that compute the new state.

/**
 * Set the caster's concentration to a new spell. If they were
 * already concentrating on something, the previous one is dropped.
 * Returns `{ actor, dropped }` so the host can fire whatever side-
 * effects "the previous spell ends" requires.
 */
export function startConcentration(actor, { spellId, level }) {
  const previous = actor.concentration ?? null;
  return {
    actor: { ...actor, concentration: { spellId, level } },
    dropped: previous
  };
}

/**
 * The DC for a CON save when concentration takes damage. SRD: max
 * of 10 and half the damage taken (round down).
 */
export function concentrationSaveDC(damageTaken) {
  if (!Number.isFinite(damageTaken) || damageTaken < 0) {
    throw new Error('damageTaken must be a non-negative number');
  }
  return Math.max(10, Math.floor(damageTaken / 2));
}

/**
 * Drop concentration unconditionally (incapacitated, dead,
 * deliberate release). Returns the new actor.
 */
export function endConcentration(actor) {
  if (!actor.concentration) return actor;
  const { concentration: _, ...rest } = actor;
  return rest;
}

// === Cantrip scaling ===
//
// SRD 5.2 cantrip damage scales at levels 5, 11, and 17 — extra
// damage dice match the breakpoint tier. Spell records carry their
// base damage spec (e.g. `1d10` for Fire Bolt); the scaling
// function returns the spec at a given level.
//
// `scaledDamageSpec` parses the base, multiplies the count by the
// tier multiplier, and re-serialises. Falls back to the original
// when the spec doesn't match `XdY` form.

const DICE_PATTERN = /^(\d+)d(\d+)([+-]\d+)?$/;

export function cantripTier(casterLevel) {
  if (casterLevel >= 17) return 4;
  if (casterLevel >= 11) return 3;
  if (casterLevel >= 5) return 2;
  return 1;
}

export function scaledDamageSpec(baseSpec, casterLevel) {
  const m = DICE_PATTERN.exec(String(baseSpec).trim());
  if (!m) return baseSpec;
  const tier = cantripTier(casterLevel);
  const count = Number(m[1]) * tier;
  const modifier = m[3] ?? '';
  return `${count}d${m[2]}${modifier}`;
}

// === Preparation lists ===
//
// Prep-casting classes (Cleric, Druid, Paladin, Ranger, Wizard)
// know a list and prepare a subset each day. The prepared subset
// limits how many of the known list can actually be cast without
// re-prep. We model "valid prep list?" — the host owns the
// transition.

/** How many spells a class prepares per day at a given level.
 *  SRD 5.2: spellcasting ability mod + level (or half-level for
 *  half-casters). Defaults to `ability mod + level`. */
export function preparedSpellCount({ casterLevel, abilityMod, progression = 'full' }) {
  if (!Number.isInteger(casterLevel) || casterLevel < 1) {
    throw new Error('casterLevel must be a positive integer');
  }
  if (!Number.isInteger(abilityMod)) {
    throw new Error('abilityMod must be an integer');
  }
  const levelPortion = progression === 'half'
    ? Math.floor(casterLevel / 2)
    : casterLevel;
  return Math.max(1, abilityMod + levelPortion);
}

/**
 * Check that a prepared list is a subset of the known list, within
 * the prep-count budget. Returns `{ valid, reason? }`.
 *
 * Why an explicit validator: hosts will be tempted to mutate the
 * record's `spells.prepared` directly; surfacing the budget here
 * lets a UI show "5 / 7 prepared" without each consumer reimplementing
 * the math.
 */
export function validatePreparation({ known, prepared, casterLevel, abilityMod, progression }) {
  if (!Array.isArray(known) || !Array.isArray(prepared)) {
    return { valid: false, reason: 'known and prepared must be arrays' };
  }
  const knownSet = new Set(known);
  for (const id of prepared) {
    if (!knownSet.has(id)) return { valid: false, reason: `prepared spell not in known list: ${id}` };
  }
  const max = preparedSpellCount({ casterLevel, abilityMod, progression });
  if (prepared.length > max) {
    return { valid: false, reason: `prepared count ${prepared.length} exceeds budget ${max}` };
  }
  return { valid: true };
}

// === Canonical cast pipeline (since 1.8.0) ===
//
// SRD 5.2 § Spells — Casting a Spell bundles a sequence of checks:
// components (V/S/M), one-leveled-spell-per-turn, slot consumption,
// concentration binding, and (for spells with "At Higher Levels"
// text) a per-slot upcast effect. `castSpell` packages all of that
// behind a single call.
//
// The host owns the *narration* and the *effects* — `castSpell`
// just returns whether the cast went through, the new actor (with
// slot / concentration changes applied), the actual cast level
// (matters for upcast deltas), and any upcast-effect payload the
// spell record emitted. The host then applies damage / heal /
// status via the existing surfaces (Combat.applyDamage,
// Conditions.apply, etc.).

/**
 * Cast a spell. Returns:
 *   `{ ok: true, actor, castLevel, upcastEffect, ritual }`
 * on success or
 *   `{ ok: false, reason }`
 * on any refusal. The reason strings are debuggable but stable
 * shape: each refusal cites the SRD rule it enforces.
 *
 * `args`:
 *   - `slotLevel?: number` — slot to consume (defaults to
 *     `spell.level`). Used for upcasting.
 *   - `ritual?: boolean` — cast as a ritual (no slot consumed; +10
 *     minutes; spell must have the Ritual tag and be prepared).
 *   - `alreadyCastLeveledThisTurn?: boolean` — host-tracked turn
 *     flag; the engine enforces the "only one leveled spell per
 *     turn" rule when this is true.
 *
 * `actor` fields read:
 *   - `actor.silenced` / `actor.somaticBlocked` — component gates.
 *   - `actor.materials[spellId]` — opaque host-side material
 *     availability tag for spells with a `components.m.cost`.
 *   - `actor.spellsPrepared[]` — required for ritual casts.
 *   - `actor.spellSlots[]` — consumed unless ritual or cantrip.
 */
export function castSpell(actor, spell, args = {}) {
  // 1. Component checks (SRD § Spells — Components).
  const components = spell.components ?? {};
  if (components.v && actor.silenced === true) {
    return { ok: false, reason: 'silenced — cannot speak the Verbal component' };
  }
  if (components.s && actor.somaticBlocked === true) {
    return { ok: false, reason: 'no free hand for the Somatic component' };
  }
  if (components.m?.cost && actor.materials?.[spell.id] !== true) {
    return { ok: false, reason: `missing material component for ${spell.id}` };
  }

  // 2. One leveled spell per turn (SRD § Spells — Casting a Spell).
  // Cantrips (level 0) are exempt. `level > 0` short-circuits on
  // undefined so missing-level spell records (host bug) read as
  // cantrips here — the rest of the pipeline will tolerate them.
  if (spell.level > 0 && args.alreadyCastLeveledThisTurn === true) {
    return { ok: false, reason: 'only one leveled spell can be cast per turn' };
  }

  let working = actor;

  // 3. Ritual vs normal slot consumption (SRD § Spells — Ritual).
  if (args.ritual === true) {
    if (!spell.ritual) {
      return { ok: false, reason: 'spell does not have the Ritual tag' };
    }
    const prepared = Array.isArray(actor.spellsPrepared) ? actor.spellsPrepared : [];
    if (!prepared.includes(spell.id)) {
      return { ok: false, reason: 'ritual casting requires the spell to be prepared' };
    }
    // No slot consumed for ritual; the +10 minute cost is host-side.
  } else if (spell.level > 0) {
    const slotLevel = args.slotLevel ?? spell.level;
    if (!Number.isInteger(slotLevel) || slotLevel < 1) {
      return { ok: false, reason: 'slotLevel must be a positive integer' };
    }
    if (slotLevel < spell.level) {
      return { ok: false, reason: `slot level ${slotLevel} below spell's base level ${spell.level}` };
    }
    if (!Array.isArray(actor.spellSlots)) {
      return { ok: false, reason: 'actor has no spellSlots' };
    }
    const slotResult = consumeSlot(actor.spellSlots, slotLevel);
    if (!slotResult.ok) return { ok: false, reason: slotResult.reason };
    working = { ...working, spellSlots: slotResult.slots };
  }

  // 4. Concentration auto-bind (SRD § Spells — Concentration).
  // Pairs with the 1.5.0 auto-drop on incapacitating conditions.
  if (spell.concentration === true) {
    const result = startConcentration(working, { spellId: spell.id, level: args.slotLevel ?? spell.level });
    working = result.actor;
  }

  // 5. Upcast delta. Spell records expose a `upcast(level)` function
  // that returns the per-cast-level effect delta (e.g. Fireball
  // returns `{ extraDice: 1 }` per slot above 3rd).
  const castLevel = args.ritual === true ? spell.level : (args.slotLevel ?? spell.level);
  const upcastEffect = typeof spell.upcast === 'function' ? spell.upcast(castLevel) : null;

  return {
    ok: true,
    actor: working,
    castLevel,
    upcastEffect,
    ritual: args.ritual === true
  };
}

/** Convenience wrapper for ritual casting. */
export function castAsRitual(actor, spell, args = {}) {
  return castSpell(actor, spell, { ...args, ritual: true });
}

// === Area-of-effect targeting (since 1.8.0) ===
//
// SRD § Spells — Areas of Effect: six shapes (sphere, cube, cone,
// line, cylinder, emanation) targeting candidates by position. The
// engine's job is the geometry: given an origin point, a shape +
// size + facing, and a list of candidates with positions, return
// which candidates fall inside. The host owns the grid system —
// positions can be feet, squares, or anything as long as the units
// are consistent.

export const AOE_SHAPES = Object.freeze(['sphere', 'cube', 'cone', 'line', 'cylinder', 'emanation']);

function distance2D(a, b) {
  // Position correctness is the host's contract — a missing axis
  // would propagate as NaN through every comparison rather than
  // failing loudly, so no `?? 0` defensive fallback here.
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Note: cone/line take a non-zero `direction` per the outer
// `targetsInArea` guard, so the inner geometry functions don't
// re-check `dirLen === 0` — that branch would be unreachable.

function inCone2D(origin, direction, range, point) {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance === 0) return true;     // origin is inside the cone
  if (distance > range) return false;
  // 5e cone: width = length at the far end. Half-angle = atan(0.5) ≈
  // 26.57°. We use `cos(half-angle) ≈ 0.8944` as the dot-product
  // threshold so the comparison is rotation-free.
  const dirLen = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
  const cosAngle = (dx * direction.x + dy * direction.y) / (distance * dirLen);
  return cosAngle >= 0.8944;   // ~26.57° half-angle
}

function inLine2D(origin, direction, length, width, point) {
  const dirLen = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
  // Unit vectors along and perpendicular to the line.
  const ux = direction.x / dirLen;
  const uy = direction.y / dirLen;
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const along = dx * ux + dy * uy;
  const perp = Math.abs(-dx * uy + dy * ux);
  return along >= 0 && along <= length && perp <= width / 2;
}

/**
 * Return the candidates that fall inside the area.
 *
 * `args`:
 *   - `origin: { x, y }` — the spell's anchor point.
 *   - `shape: AOE_SHAPES[]` — one of the six SRD shapes.
 *   - `size: number` — radius (sphere / cylinder / emanation), side
 *     length (cube), length (cone / line).
 *   - `direction?: { x, y }` — required for cone and line; ignored
 *     elsewhere.
 *   - `width?: number` — line width (defaults to 5 ft per SRD).
 *   - `candidates: [{ id, position: { x, y } }]`.
 *
 * Returns the matching candidate records (in the same order they
 * were passed). Throws on invalid shape or missing direction for
 * cone/line — those are host bugs we surface at the boundary.
 */
export function targetsInArea({ origin, shape, size, direction, width = 5, candidates }) {
  if (!AOE_SHAPES.includes(shape)) {
    throw new Error(`Unknown AoE shape: ${shape}. Known: ${AOE_SHAPES.join(', ')}`);
  }
  if ((shape === 'cone' || shape === 'line') && (!direction || (direction.x === 0 && direction.y === 0))) {
    throw new Error(`${shape} requires a non-zero direction vector`);
  }
  if (!Array.isArray(candidates)) {
    throw new Error('candidates must be an array');
  }
  const inside = (p) => {
    if (shape === 'sphere' || shape === 'cylinder' || shape === 'emanation') {
      return distance2D(origin, p) <= size;
    }
    if (shape === 'cube') {
      return Math.abs(p.x - origin.x) <= size && Math.abs(p.y - origin.y) <= size;
    }
    if (shape === 'cone') return inCone2D(origin, direction, size, p);
    /* shape === 'line' */ return inLine2D(origin, direction, size, width, p);
  };
  return candidates.filter((c) => inside(c.position));
}

/**
 * Package per-target save outcomes for a save-or-suck / save-for-
 * half spell. The host runs each save (via `Checks.savingThrow`)
 * and feeds the results in; the engine computes the applied
 * damage / outcome per target uniformly.
 *
 * `results: [{ targetId, saved: boolean, damage?: number }]`
 * `opts.halfOnSuccess` defaults to `true` (the SRD default for
 *  Dex-save Evocation spells like Fireball); set `false` for
 *  save-or-suck spells where success means no effect at all.
 */
export function castSpellSave(results, { halfOnSuccess = true } = {}) {
  if (!Array.isArray(results)) {
    throw new Error('results must be an array');
  }
  return results.map((r) => ({
    targetId: r.targetId,
    saved: r.saved === true,
    appliedDamage: r.saved
      ? (halfOnSuccess ? Math.floor((r.damage ?? 0) / 2) : 0)
      : (r.damage ?? 0)
  }));
}
