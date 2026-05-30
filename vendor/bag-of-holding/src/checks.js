import { rollDie } from './dice.js';

// SRD 5.2 § Ability Checks — Typical Difficulty Classes: the table
// runs Very Easy (5), Easy (10), Medium (15), Hard (20), Very Hard
// (25), Nearly Impossible (30). Anything outside that band is a
// content bug (or an LLM hallucinating an obstacle) — we clamp at
// the engine boundary so a stray DC 100 can't soft-lock the game.
const MIN_DC = 5;
const MAX_DC = 30;

/**
 * The 5e ability modifier is `(score − 10) / 2`, **floored toward
 * −∞**, not rounded. That's the well-known quirk that makes a 9 give
 * −1 rather than 0; reimplementing it with `Math.round` is the most
 * common porting bug from systems that round differently, so it
 * lives in one place where we can be sure.
 */
export function modFromScore(score) {
  return Math.floor((score - 10) / 2);
}

/**
 * Clamp into [MIN_DC, MAX_DC]. We clamp silently instead of throwing
 * because most callers feed DCs from AI-generated content — a hard
 * fail would surface as a turn crash, while clamping degrades into
 * "merely very hard" and the player keeps playing.
 */
export function clampDC(dc) {
  return Math.max(MIN_DC, Math.min(MAX_DC, dc));
}

/**
 * Roll a single d20 ability check against a clamped DC. Returns the
 * raw d20 alongside the totals so the UI can show the die face
 * (Nerd mode) without re-deriving anything, and so `success` doesn't
 * have to be re-computed by callers — they already know if they hit.
 *
 * `proficient` defaults to false because most checks aren't
 * proficient, and forgetting the flag should bias toward the less
 * favourable outcome rather than the more favourable one. The `rng`
 * cascades through `rollDie` so a seeded engine produces reproducible
 * check sequences end-to-end.
 */
export function abilityCheck({ abilityScore, proficient = false, proficiencyBonus = 2, dc }, rng = Math.random) {
  const d20 = rollDie(20, rng);
  const mod = modFromScore(abilityScore) + (proficient ? proficiencyBonus : 0);
  const total = d20 + mod;
  const target = clampDC(dc);
  return { d20, mod, total, dc: target, success: total >= target };
}

/**
 * In 5e the math for a saving throw is identical to an ability check
 * (d20 + ability mod ± proficiency vs DC); the two are conceptually
 * distinct (active reach vs passive resistance), so the engine keeps
 * the names separate even though one delegates. That makes call
 * sites — and grep — read closer to the rule being applied.
 *
 * `args.autoFailed: true` (since 1.5.0) short-circuits the d20 roll
 * and returns a failed save with `autoFailed: true` on the result —
 * for the SRD condition flags (paralyzed / stunned / petrified /
 * unconscious force auto-fail on STR/DEX saves). The engine binding
 * sets this flag automatically from the actor's active conditions
 * when the caller supplies an `actor` and an `ability`. Callers
 * using `Checks.savingThrow` directly can also pass `autoFailed: true`
 * for the same short-circuit behaviour.
 */
export function savingThrow(args, rng = Math.random) {
  if (args.autoFailed === true) {
    return {
      d20: 0,
      mod: 0,
      total: 0,
      dc: clampDC(args.dc),
      success: false,
      autoFailed: true
    };
  }
  return abilityCheck(args, rng);
}
