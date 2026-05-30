// === Scene clock (since 1.6.0) ===
//
// SRD durations and refresh boundaries that aren't round-scoped need
// a wall-clock representation. The scene clock is a small pure data
// object the host advances when in-fiction time passes. The engine
// reports back which day-cycle boundaries (Dawn / Dusk) were crossed
// so plugin-side handlers (magic-item recharge, certain spell
// expiries) can fire at the right moment.
//
//   scene = { minutes: 0, dawnMinute: 360, duskMinute: 1080 }
//
// `minutes` accumulates as the host advances; we wrap-mod by 1440 for
// the cross-day detection so a 10-hour advance correctly fires Dawn
// (or Dusk, or both, depending on the start hour). Default Dawn / Dusk
// boundaries are 06:00 / 18:00 (SRD conventional); custom packs can
// override them by setting the scene fields explicitly.

/** Default Dawn boundary in minutes-from-midnight (06:00). */
export const DEFAULT_DAWN_MINUTE = 360;
/** Default Dusk boundary in minutes-from-midnight (18:00). */
export const DEFAULT_DUSK_MINUTE = 1080;
/** Minutes in a full day cycle. */
export const MINUTES_PER_DAY = 1440;

/**
 * Build a fresh scene clock at the named start time. `startMinute`
 * defaults to `DEFAULT_DAWN_MINUTE` so a new session opens at Dawn.
 * Plugin-overridable Dawn / Dusk boundaries land on the scene
 * record itself; advancers read them from there.
 */
export function freshScene({ startMinute = DEFAULT_DAWN_MINUTE, dawnMinute = DEFAULT_DAWN_MINUTE, duskMinute = DEFAULT_DUSK_MINUTE } = {}) {
  if (!Number.isInteger(startMinute) || startMinute < 0) {
    throw new Error('freshScene: startMinute must be a non-negative integer');
  }
  return { minutes: startMinute, dawnMinute, duskMinute };
}

/**
 * Advance the scene clock by a delta. Returns
 *   `{ scene, events }`
 * where `events` is an ordered list of boundary crossings (`'dawn'`
 * or `'dusk'`) that occurred during the advance. Multiple crossings
 * are possible — advancing by 30 hours starting at noon emits
 * dusk → dawn → dusk → dawn, in chronological order.
 *
 * `delta` accepts any combination of `rounds`, `minutes`, `hours`,
 * `days`. 1 round = 6 seconds (SRD), so 10 rounds = 1 minute.
 */
export function advanceTime(scene, delta = {}) {
  if (!scene || typeof scene !== 'object') {
    throw new Error('advanceTime: scene must be an object');
  }
  const minutesDelta =
    (delta.minutes ?? 0) +
    (delta.hours ?? 0) * 60 +
    (delta.days ?? 0) * MINUTES_PER_DAY +
    Math.floor((delta.rounds ?? 0) / 10);
  if (minutesDelta < 0) {
    throw new Error('advanceTime: scene clocks only move forward');
  }
  const before = scene.minutes ?? 0;
  const after = before + minutesDelta;
  const dawn = scene.dawnMinute ?? DEFAULT_DAWN_MINUTE;
  const dusk = scene.duskMinute ?? DEFAULT_DUSK_MINUTE;
  const events = [];

  // Walk forward day by day to enumerate every boundary crossed.
  // Each iteration covers up to one Dawn and one Dusk. Bounded by
  // the minutesDelta so a sane caller can't burn cycles on a 50-year
  // advance.
  let cursor = before;
  while (cursor < after) {
    const dayStart = Math.floor(cursor / MINUTES_PER_DAY) * MINUTES_PER_DAY;
    const dawnAt = dayStart + dawn;
    const duskAt = dayStart + dusk;
    const nextEdges = [dawnAt, duskAt, dayStart + MINUTES_PER_DAY]
      .filter((m) => m > cursor && m <= after)
      .sort((a, b) => a - b);
    if (nextEdges.length === 0) break;
    for (const edge of nextEdges) {
      if (edge === dayStart + MINUTES_PER_DAY) continue;   // day rollover, not an event
      if (edge === dawnAt) events.push('dawn');
      else if (edge === duskAt) events.push('dusk');
    }
    cursor = nextEdges[nextEdges.length - 1];
  }

  return {
    scene: { ...scene, minutes: after },
    events
  };
}

/**
 * Pretty-format a scene-clock minute as `HH:MM` for UI labels.
 * Wraps the input mod 1440 so an arbitrarily-large minute count
 * still renders as a time-of-day.
 */
export function formatTimeOfDay(minutes) {
  const m = ((minutes ?? 0) % MINUTES_PER_DAY + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hh = Math.floor(m / 60).toString().padStart(2, '0');
  const mm = (m % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}
