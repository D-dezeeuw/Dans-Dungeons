// === Variant rules: encounter + skills (2.16.0) ===
//
// The last of the three variant milestones: group / side initiative,
// honor-piety-renown stat tracking, background-as-proficiency, and the
// fewer-skills-more-options grouping. Same contract as VariantCombat and
// VariantRest — pure opt-in helpers the host invokes, feeding results
// back through existing surfaces (the initiative order it builds, the
// `proficient` flag on Checks.abilityCheck).

import { rollDie } from '../dice.js';
import { modFromScore } from '../checks.js';
import { SKILL_ABILITY } from '../character.js';

// ── Side initiative (DMG variant) ───────────────────────────────────────
//
// One d20 per SIDE, no modifiers; the winning side acts first, its
// members in any order they choose. Ties reroll until broken, so the
// result is always a strict order.

export function sideInitiative(sideIds, rng = Math.random) {
  if (!Array.isArray(sideIds) || sideIds.length < 2) {
    return { ok: false, reason: 'side initiative needs at least two sides' };
  }
  const rolls = sideIds.map((id) => ({ side: id, d20: rollDie(20, rng) }));
  // Reroll ties as a group until every side's roll is unique.
  for (;;) {
    const seen = new Map();
    for (const r of rolls) seen.set(r.d20, (seen.get(r.d20) ?? 0) + 1);
    const tied = rolls.filter((r) => seen.get(r.d20) > 1);
    if (tied.length === 0) break;
    for (const r of tied) r.d20 = rollDie(20, rng);
  }
  const order = [...rolls].sort((a, b) => b.d20 - a.d20);
  return { ok: true, order };
}

// ── Group initiative ────────────────────────────────────────────────────
//
// One roll per GROUP of identical creatures (all the wolves act
// together), d20 + the group's DEX modifier. Groups keep their id and
// arrive back sorted; ties break toward the higher modifier, then
// reroll.

export function groupInitiative(groups, rng = Math.random) {
  if (!Array.isArray(groups) || groups.length === 0) {
    return { ok: false, reason: 'group initiative needs at least one group' };
  }
  const rolls = groups.map((g) => {
    const mod = modFromScore(g.dexterity ?? 10);
    return { group: g.id, d20: rollDie(20, rng), mod };
  });
  const total = (r) => r.d20 + r.mod;
  for (;;) {
    const seen = new Map();
    for (const r of rolls) {
      const key = `${total(r)}:${r.mod}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    const tied = rolls.filter((r) => seen.get(`${total(r)}:${r.mod}`) > 1);
    if (tied.length === 0) break;
    for (const r of tied) r.d20 = rollDie(20, rng);
  }
  const order = [...rolls]
    .sort((a, b) => total(b) - total(a) || b.mod - a.mod)
    .map((r) => ({ group: r.group, initiative: total(r), d20: r.d20, mod: r.mod }));
  return { ok: true, order };
}

// ── Honor / piety / renown tracks ───────────────────────────────────────
//
// Named scalar tracks on the actor (`actor.tracks[trackId]`), clamped
// to a declared band. The classic three ship as presets; any id works.
// Pure: actor in, actor out.

export const TRACK_PRESETS = Object.freeze({
  honor: Object.freeze({ min: 0, max: 20, start: 10 }),
  piety: Object.freeze({ min: 0, max: 50, start: 0 }),
  renown: Object.freeze({ min: 0, max: 50, start: 0 }),
});

export function adjustTrack(actor, trackId, delta, band = TRACK_PRESETS[trackId] ?? { min: 0, max: 50, start: 0 }) {
  const tracks = actor.tracks ?? {};
  const current = tracks[trackId] ?? band.start ?? 0;
  const next = Math.max(band.min, Math.min(band.max, current + delta));
  return {
    actor: { ...actor, tracks: { ...tracks, [trackId]: next } },
    value: next,
    changed: next - current,
  };
}

export function trackValue(actor, trackId, band = TRACK_PRESETS[trackId] ?? { start: 0 }) {
  return actor.tracks?.[trackId] ?? band.start ?? 0;
}

/** Resolve a value against ordered rank thresholds `[{ at, name }]`
 *  (ascending). Returns the highest rank reached, or null below all. */
export function rankFor(value, ranks) {
  let best = null;
  for (const rank of ranks) {
    if (value >= rank.at) best = rank;
  }
  return best;
}

/** Default renown ladder — faction standing per accumulated renown. */
export const RENOWN_RANKS = Object.freeze([
  Object.freeze({ at: 3, name: 'trusted' }),
  Object.freeze({ at: 10, name: 'agent' }),
  Object.freeze({ at: 25, name: 'commander' }),
  Object.freeze({ at: 50, name: 'voice-of-the-faction' }),
]);

// ── Background as proficiency (DMG variant) ─────────────────────────────
//
// Instead of fixed skill lists, a check "within your background's
// wheelhouse" adds proficiency. Whether a claim is in the wheelhouse
// is the table's judgment; this helper gives the DEFAULT judgment (the
// background's own skill list) and the host feeds the verdict into
// Checks.abilityCheck's existing `proficient` flag — no new check math.

export function backgroundApplies(background, skillId) {
  return Array.isArray(background?.skillProficiencies)
    && background.skillProficiencies.includes(skillId);
}

// ── Fewer skills, more options ──────────────────────────────────────────
//
// The 18 SRD skills collapse into six broad competences. A partition,
// not a suggestion: every skill appears in exactly one group (asserted
// in tests against SKILL_ABILITY, so a new skill can't slip through
// ungrouped). Checks use the group the same way — d20 + ability mod,
// `proficient` if the actor is proficient in the GROUP.

export const SKILL_GROUPS = Object.freeze({
  brawn: Object.freeze(['athletics', 'intimidation']),
  finesse: Object.freeze(['acrobatics', 'sleight-of-hand', 'stealth']),
  wits: Object.freeze(['arcana', 'history', 'investigation', 'nature', 'religion']),
  senses: Object.freeze(['insight', 'perception', 'survival', 'medicine']),
  presence: Object.freeze(['deception', 'performance', 'persuasion']),
  wilds: Object.freeze(['animal-handling']),
});

export function groupFor(skillId) {
  for (const [group, skills] of Object.entries(SKILL_GROUPS)) {
    if (skills.includes(skillId)) return group;
  }
  return null;
}

// Re-exported so hosts can sanity-check the partition themselves.
export { SKILL_ABILITY };
