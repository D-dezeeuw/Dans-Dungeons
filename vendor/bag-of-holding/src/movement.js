// === Movement & vision (SRD 5.2, since 1.11.0) ===
//
// The single `speed` value the engine has carried since 0.0.0
// expands into per-mode speeds, environment-aware movement (terrain
// + obscured), falling damage, and the vision system (light levels,
// special senses, line-of-sight predicates).
//
// All functions are pure: actor and scene state come in, results
// (often new actor / new state) come out. The host owns the world
// model (positions, lighting maps, line-of-sight raycasts); the
// engine provides the math primitives.

import { rollDie } from './dice.js';

// === Movement modes (SRD § Adventuring — Special Types of Movement) ===

/** Movement modes the engine recognises. */
export const MOVEMENT_MODES = Object.freeze(['walk', 'fly', 'swim', 'climb', 'burrow']);

/**
 * Resolve an actor's speed for a given movement mode. Reads
 * `actor.speeds: { walk?, fly?, swim?, climb?, burrow? }` first; if
 * the mode isn't declared, falls back to `actor.speed` for `walk`
 * only (legacy default). Other modes return 0 when undeclared.
 */
export function speedFor(actor, mode) {
  if (!MOVEMENT_MODES.includes(mode)) {
    throw new Error(`speedFor: unknown movement mode: ${mode}`);
  }
  const speeds = actor.speeds;
  if (speeds && Number.isInteger(speeds[mode])) return speeds[mode];
  if (mode === 'walk' && Number.isInteger(actor.speed)) return actor.speed;
  return 0;
}

/**
 * Cost (in feet) to move `feet` over the given terrain. SRD §
 * Adventuring — Movement: each foot of difficult terrain costs an
 * extra foot. `crawling: true` doubles the cost (per § Conditions —
 * Prone).
 */
export function movementCost(feet, { difficult = false, crawling = false } = {}) {
  if (!Number.isInteger(feet) || feet < 0) {
    throw new Error('movementCost: feet must be a non-negative integer');
  }
  let cost = feet;
  if (difficult) cost *= 2;
  if (crawling) cost *= 2;
  return cost;
}

// === Falling (SRD § Adventuring — Falling) ===

/**
 * Compute and roll falling damage for a distance. SRD: `1d6 per
 * 10 ft`, max `20d6`. Returns `{ dice, total, prone, rolls }`.
 * `prone` is always true when damage was taken — the SRD says a
 * fall ends with the creature prone unless they avoided damage.
 */
export function fall(distanceFt, rng = Math.random) {
  if (!Number.isFinite(distanceFt) || distanceFt < 0) {
    throw new Error('fall: distanceFt must be a non-negative number');
  }
  const dice = Math.min(20, Math.floor(distanceFt / 10));
  const rolls = [];
  let total = 0;
  for (let i = 0; i < dice; i++) {
    const face = rollDie(6, rng);
    rolls.push(face);
    total += face;
  }
  return { dice, total, rolls, prone: total > 0 };
}

// === Jumping (SRD § Adventuring — Movement) ===

function strMod(actor) {
  const score = actor.abilityScores?.str ?? 10;
  return Math.floor((score - 10) / 2);
}

/**
 * Long jump distance per SRD: `STR mod` feet with a 10-ft running
 * start; halved without the running start. Returns the distance in
 * feet (always ≥ 0).
 */
export function longJump(actor, { runningStart = true } = {}) {
  const mod = Math.max(0, strMod(actor));
  return runningStart ? mod : Math.floor(mod / 2);
}

/**
 * High jump height per SRD: `3 + STR mod` feet with a 10-ft
 * running start; halved without. Returns the height in feet.
 */
export function highJump(actor, { runningStart = true } = {}) {
  const base = Math.max(0, 3 + strMod(actor));
  return runningStart ? base : Math.floor(base / 2);
}

// === Light levels + vision (SRD § Adventuring — Vision and Light) ===

/** The three SRD light levels, brightest-first. */
export const LIGHT_LEVELS = Object.freeze(['bright', 'dim', 'darkness']);

/**
 * Effective light level for `viewer` looking at `target` given the
 * ambient light level and the viewer's senses. SRD:
 *   - Darkvision (range): converts darkness → dim, dim → bright,
 *     within range.
 *   - Blindsight / truesight (range): see everything inside the
 *     range regardless of light or invisibility.
 *
 * Inputs:
 *   - `viewer.senses: { darkvision?, blindsight?, truesight? }` (ft)
 *   - `ambient: 'bright' | 'dim' | 'darkness'`
 *   - `distanceFt: number` — viewer-to-target distance
 *
 * Returns the perceived light level for the viewer.
 */
export function effectiveLight(viewer, { ambient, distanceFt }) {
  if (!LIGHT_LEVELS.includes(ambient)) {
    throw new Error(`effectiveLight: unknown ambient level: ${ambient}`);
  }
  const senses = viewer.senses ?? {};
  const truesight = senses.truesight ?? 0;
  if (distanceFt <= truesight) return 'bright';
  const blindsight = senses.blindsight ?? 0;
  if (distanceFt <= blindsight) return 'bright';
  const darkvision = senses.darkvision ?? 0;
  if (distanceFt <= darkvision) {
    if (ambient === 'darkness') return 'dim';
    if (ambient === 'dim') return 'bright';
  }
  return ambient;
}

/**
 * Obscured state (SRD § Adventuring — Vision and Light):
 *   - `heavy`: effectively blinded for sight-dependent rolls.
 *   - `light`: disadvantage on Perception checks that rely on sight.
 *   - `none`: no penalty.
 *
 * Wraps `effectiveLight` into a coarser classification:
 *   - darkness → heavily obscured
 *   - dim      → lightly obscured
 *   - bright   → not obscured
 */
export function obscuredState(viewer, { ambient, distanceFt }) {
  const light = effectiveLight(viewer, { ambient, distanceFt });
  if (light === 'darkness') return 'heavy';
  if (light === 'dim') return 'light';
  return 'none';
}

// === Line of sight (SRD § Spells — Targets) ===

/**
 * Predicate: can `observer` see `target`? The engine doesn't model
 * positions itself — the host supplies an `obstacles` array, each
 * `{ blocksSight: true }` or similar. The most useful canonical
 * check is "any obstacle between them blocks sight"; the host can
 * tighten the predicate via plugin if needed.
 *
 * Returns `true` if no obstacle has `blocksSight: true`. The host
 * is responsible for filtering `obstacles` to those that actually
 * lie on the line — the engine's role is the predicate, not the
 * raycast.
 */
export function hasLineOfSight(_observer, _target, obstacles = []) {
  return !obstacles.some((o) => o && o.blocksSight === true);
}

/**
 * Predicate: line of *effect* (SRD § Spells — Targets — Line of
 * Effect). Like line of sight but the obstacle category is "blocks
 * effect" instead of "blocks sight" (a magical darkness blocks
 * sight but not effect; a glass wall blocks effect but not sight).
 */
export function hasLineOfEffect(_origin, _target, obstacles = []) {
  return !obstacles.some((o) => o && o.blocksEffect === true);
}
