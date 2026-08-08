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

/**
 * Roll the d20 for a check or save, honouring advantage and disadvantage.
 *
 * Neither ability checks nor saving throws could express these before, so the
 * condition flags conditions.js itself declares (ownCheckDisadvantage,
 * saveDexDisadvantage, attackAgainstAdvantage) were unenforceable — a poisoned
 * or restrained character rolled exactly like a healthy one, and Magic
 * Resistance was hacked in as a -5 to the DC.
 *
 * Per the SRD, advantage and disadvantage do not stack and cancel each other
 * out exactly: any number of each on the same roll resolves to one straight d20.
 */
function d20With({ advantage = false, disadvantage = false }, rng) {
  if (advantage && disadvantage) return { d20: rollDie(20, rng), stance: 'normal' };
  if (advantage) {
    const a = rollDie(20, rng), b = rollDie(20, rng);
    return { d20: Math.max(a, b), stance: 'advantage', rolls: [a, b] };
  }
  if (disadvantage) {
    const a = rollDie(20, rng), b = rollDie(20, rng);
    return { d20: Math.min(a, b), stance: 'disadvantage', rolls: [a, b] };
  }
  return { d20: rollDie(20, rng), stance: 'normal' };
}

export function abilityCheck(
  { abilityScore, proficient = false, proficiencyBonus = 2, dc, advantage = false, disadvantage = false, bonus = 0 },
  rng = Math.random,
) {
  const { d20, stance, rolls } = d20With({ advantage, disadvantage }, rng);
  const mod = modFromScore(abilityScore) + (proficient ? proficiencyBonus : 0) + (bonus || 0);
  const total = d20 + mod;
  const target = clampDC(dc);
  const out = { d20, mod, total, dc: target, success: total >= target, stance };
  if (rolls) out.rolls = rolls;
  return out;
}

/**
 * Roll a tool check against a DC. Mechanically identical to an ability
 * check (d20 + ability mod ± tool proficiency bonus vs DC) but named
 * separately so call sites read closer to the rule being applied, and
 * so the roll log can tag entries with the `toolId` for host-side
 * rendering ("rolled Thieves' Tools check vs DC 15").
 *
 * The governing ability (DEX for lockpicking, WIS for herbalism, STR
 * for smithing) is caller-supplied — the SRD leaves this open for
 * context-driven GM rulings. The engine-bound version auto-resolves
 * proficiency from `actor.tools` when an `actor` is passed.
 *
 * @param {object} args
 * @param {string}  [args.toolId]         Optional id for logging.
 * @param {number}   args.abilityScore     Governing ability score.
 * @param {boolean} [args.proficient]      Whether the actor is proficient.
 * @param {number}  [args.proficiencyBonus] Prof bonus (default 2).
 * @param {number}   args.dc               Target DC.
 */
export function toolCheck({ toolId, ...checkArgs }, rng = Math.random) {
  const result = abilityCheck(checkArgs, rng);
  return toolId !== undefined ? { ...result, toolId } : result;
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

/**
 * SRD 5.2 § Ability Checks — Passive Checks: a passive check is an
 * ability check that doesn't involve any die rolls. The total is
 * `10 + ability mod + proficiency + bonuses`. Advantage grants +5;
 * disadvantage grants -5.
 *
 * The derived sheet computes passive Perception / Insight /
 * Investigation already (since v0.1.5). This helper is the general-
 * purpose form for the other 15 skills, plus arbitrary saves.
 */
export function passiveCheck({ abilityScore, proficient = false, proficiencyBonus = 2, advantage = false, disadvantage = false, bonus = 0 } = {}) {
  if (!Number.isFinite(abilityScore)) {
    throw new Error('passiveCheck: abilityScore must be a finite number');
  }
  let total = 10 + modFromScore(abilityScore) + bonus;
  if (proficient) total += proficiencyBonus;
  if (advantage && !disadvantage) total += 5;
  if (disadvantage && !advantage) total -= 5;
  return total;
}
