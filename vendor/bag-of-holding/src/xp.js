/**
 * SRD 5.2 XP-to-level table. Tier 1 (L1–4), Tier 2 (L5–10),
 * and the rest of the curve through L20.
 */
export const THRESHOLDS = Object.freeze({
  1: 0,      2: 300,    3: 900,    4: 2700,   5: 6500,
  6: 14000,  7: 23000,  8: 34000,  9: 48000, 10: 64000,
  11: 85000, 12: 100000, 13: 120000, 14: 140000, 15: 165000,
  16: 195000, 17: 225000, 18: 265000, 19: 305000, 20: 355000
});

/**
 * Proficiency bonus as a lookup, not a formula. SRD 5.2:
 * +2 at 1–4, +3 at 5–8, +4 at 9–12, +5 at 13–16, +6 at 17–20.
 */
export const PROFICIENCY_BY_LEVEL = Object.freeze({
  1: 2,  2: 2,  3: 2,  4: 2,
  5: 3,  6: 3,  7: 3,  8: 3,
  9: 4, 10: 4, 11: 4, 12: 4,
  13: 5, 14: 5, 15: 5, 16: 5,
  17: 6, 18: 6, 19: 6, 20: 6
});

/**
 * Linear scan rather than binary search because THRESHOLDS has 5
 * entries; introducing log-n complexity for a 5-element table is
 * the classic premature optimisation. Re-evaluate if level cap
 * ever exceeds tier 1.
 *
 * The optional `thresholds` parameter lets rule-modification plugins
 * substitute a custom progression curve (gritty/heroic packs) without
 * forking this module. Default keeps the SRD 5.2 baseline.
 */
export function levelForXP(xp, thresholds = THRESHOLDS) {
  let level = 1;
  for (const [lvl, threshold] of Object.entries(thresholds)) {
    if (xp >= threshold) level = Number(lvl);
  }
  return level;
}

/**
 * Returns `null` (not `undefined`) at the level cap so the UI can
 * distinguish "max level reached" from "value not yet computed".
 * Callers rendering progression bars rely on this discriminator.
 */
export function nextLevelThreshold(xp, thresholds = THRESHOLDS) {
  const current = levelForXP(xp, thresholds);
  return thresholds[current + 1] ?? null;
}

/**
 * Milestone XP keyed off a beat's `targetPlaytimeMinutes` rather
 * than a fixed "kill XP" budget. The 10-xp-per-minute rate is the
 * tuning constant: a 30-minute beat → 300 xp → exactly the L1→L2
 * threshold under the SRD curve. Treat the multiplier as the dial
 * we'll turn once real playtest data lands.
 *
 * Defaults to 30 minutes when the beat omits the field so that
 * hand-authored beats and older save formats don't crash the loop;
 * 30 is the midpoint of the expected beat length. The `thresholds`
 * parameter is threaded through for the level-up detection.
 */
export function awardMilestone({ pc, beat }, thresholds = THRESHOLDS) {
  const minutes = beat?.targetPlaytimeMinutes ?? 30;
  const xpDelta = Math.round(minutes * 10);
  const newTotal = pc.xp + xpDelta;
  return { xpDelta, newTotal, willLevelUp: levelForXP(newTotal, thresholds) > pc.level };
}
