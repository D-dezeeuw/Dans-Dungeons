// === Variant rules: rest + downtime (2.15.0) ===
//
// The knob half of this milestone lives in rules.js (three new
// longRestHitDiceRecovery-style knobs: `longRestHpRecovery`,
// `hitDiceRequireHealersKit`, `restDurationScale`) and is consumed by
// rest.js. This module carries the parts that aren't knobs: the
// optional sanity track and the exhaustion-on-failure stake, both pure
// and host-invoked, same contract as VariantCombat.
//
// Sanity is an OPTIONAL seventh score. An actor that carries
// `sanity: 3..18` can face sanity checks (d20 + mod vs DC, the same
// modFromScore curve as every ability) and take sanity loss; at 0 the
// mind breaks — a state, not a death. Actors without the field are
// untouched by the whole subsystem: no check, no loss, no flags.

import { modFromScore } from '../checks.js';
import { exhaustion } from '../conditions.js';

/**
 * Roll a sanity check: d20 + modFromScore(actor.sanity) vs DC.
 * Returns `{ ok: false, reason }` for actors with no sanity track —
 * the variant only exists for tables (and actors) that opted in.
 */
export function sanityCheck(actor, { dc = 10, advantage = false, disadvantage = false } = {}, rng = Math.random) {
  if (!Number.isInteger(actor?.sanity)) {
    return { ok: false, reason: 'actor has no sanity track (variant not in play)' };
  }
  const d = () => 1 + Math.floor(rng() * 20);
  let d20 = d();
  let stance = 'normal';
  if (advantage && !disadvantage) { d20 = Math.max(d20, d()); stance = 'advantage'; }
  else if (disadvantage && !advantage) { d20 = Math.min(d20, d()); stance = 'disadvantage'; }
  const mod = modFromScore(actor.sanity);
  const total = d20 + mod;
  return { ok: true, d20, mod, total, dc, success: total >= dc, stance };
}

/**
 * Apply sanity loss. Clamps at 0; crossing 0 marks the actor
 * `mindBroken: true` — a state for the host to narrate (long-term
 * care, a quest, greater restoration), deliberately NOT death.
 * Recovery via `restoreSanity`.
 */
export function applySanityLoss(actor, amount) {
  if (!Number.isInteger(actor?.sanity)) {
    return { ok: false, reason: 'actor has no sanity track (variant not in play)' };
  }
  const loss = Math.max(0, amount | 0);
  const next = Math.max(0, actor.sanity - loss);
  const out = { ...actor, sanity: next };
  if (next === 0) out.mindBroken = true;
  return { ok: true, actor: out, lost: actor.sanity - next };
}

/** Restore sanity points, capped at 18; leaving 0 clears `mindBroken`. */
export function restoreSanity(actor, amount) {
  if (!Number.isInteger(actor?.sanity)) {
    return { ok: false, reason: 'actor has no sanity track (variant not in play)' };
  }
  const next = Math.min(18, actor.sanity + Math.max(0, amount | 0));
  const out = { ...actor, sanity: next };
  if (next > 0 && out.mindBroken) delete out.mindBroken;
  return { ok: true, actor: out, restored: next - actor.sanity };
}

/**
 * The exhaustion-on-failure stake: gritty tables rule that failing a
 * given check costs a level of exhaustion (forced marches, night
 * terrors, starvation checks). Feed any check result carrying a
 * `success` field; on failure the actor gains `levels` of exhaustion
 * through the real exhaustion machinery (death at 6 included).
 */
export function exhaustionOnFailure(actor, checkResult, levels = 1) {
  if (checkResult?.success !== false) return { applied: false, actor };
  return { applied: true, actor: exhaustion.gain(actor, levels) };
}
