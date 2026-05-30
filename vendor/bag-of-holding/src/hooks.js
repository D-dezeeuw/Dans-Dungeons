// === Behavioural hooks (plugin Phase C) ===
//
// Phase A let plugins contribute *content* (species, classes, items,
// conditions, mastery handlers). Phase B let them tune the *math*
// (crit/fumble thresholds, damage floor, exploding dice, XP curves).
// Phase C closes the trifecta: plugins can react to events the engine
// fires as it resolves a turn.
//
// The hook surface is deliberately small. Five events cover the
// canonical "do something *around* a resolution" cases that show up
// in real homebrew (the Shield spell, Sneak Attack riders, level-up
// announcements, on-death triggers, condition-onset effects). If we
// shipped fifteen speculative hooks we'd lock ourselves into a
// contract before any consumer has used the first one.
//
// Contract for every hook:
//   - **Pure-ish.** Hooks return either `undefined` (do nothing) or a
//     plain "delta" object the engine merges into the result. They
//     must never mutate engine state or other actors' records.
//   - **Order = registration order.** Plugins that care about order
//     should register a single hook that internally sequences sub-
//     behaviours rather than depending on registration order between
//     plugins.
//   - **Per-engine isolation.** Hooks live on the engine instance.
//     One engine's hooks never fire on another's resolutions.
//   - **Throw-loud, throw-once.** Errors thrown in a hook propagate
//     to the caller. The engine doesn't swallow them: a hook bug
//     should surface at the offending turn, not silently corrupt
//     state.

/**
 * The closed set of hook event names the engine fires. Frozen so a
 * typo at registration time fails loud (`hooks.beforAttack` is a
 * bug, not a never-firing dead hook).
 */
export const HOOK_EVENTS = Object.freeze([
  // Phase C — combat / progression events (since 0.3.0).
  'beforeAttack',
  'afterDamage',
  'onLevelUp',
  'onConditionApplied',
  'onDeath',
  // Phase D — turn lifecycle + scene events (since 1.6.0).
  // Hosts call `engine.Combat.turnStart` / `turnEnd` to fire the
  // first two; the engine fires the rest from the bound surfaces
  // (Rest.longRest, Rest.shortRest, Combat.applyDamage, casting).
  'onTurnStart',
  'onTurnEnd',
  'onLongRest',
  'onShortRest',
  'onCast',
  'onDamageApplied',
  'onHpChanged'
]);

/**
 * Build a fresh hooks registry. Each event maps to an append-only
 * array of handlers; `fire(event, payload)` walks them in order and
 * folds returned deltas into the payload via `Object.assign` so the
 * next handler sees the merged state.
 *
 * Why not an EventEmitter: we want synchronous, ordered, transform-
 * style dispatch — async/emit semantics would break replay-
 * determinism and force the rest of the engine to deal with
 * promises. Plain functions in arrays are smaller and clearer.
 */
export function buildHookRegistry(extras = {}) {
  if (extras === null || typeof extras !== 'object' || Array.isArray(extras)) {
    throw new Error('hooks must be an object');
  }
  const handlers = {};
  for (const event of HOOK_EVENTS) handlers[event] = [];

  for (const [event, value] of Object.entries(extras)) {
    if (!HOOK_EVENTS.includes(event)) {
      throw new Error(`Unknown hook event: ${event}. Known: ${HOOK_EVENTS.join(', ')}`);
    }
    const list = Array.isArray(value) ? value : [value];
    for (const fn of list) {
      if (typeof fn !== 'function') {
        throw new Error(`hooks.${event} entries must be functions`);
      }
      handlers[event].push(fn);
    }
  }

  /**
   * Dispatch one event. Handlers run in registration order; each
   * receives the (possibly merged) payload and returns either
   * `undefined` (no change) or a partial delta object that is
   * `Object.assign`-merged into the payload before the next
   * handler. Returns the final payload — callers usually treat it
   * as opaque, but for hooks that *replace* a result (e.g.
   * `beforeAttack` short-circuits) the merged payload is what the
   * engine then acts on.
   *
   * `cancelled: true` in any handler's return short-circuits the
   * remaining handlers and is surfaced on the final payload so the
   * caller can branch on it (e.g. attack cancelled by Shield).
   */
  function fire(event, payload) {
    let merged = { ...payload };
    for (const handler of handlers[event]) {
      const delta = handler(merged);
      if (delta && typeof delta === 'object') {
        merged = { ...merged, ...delta };
        if (merged.cancelled === true) break;
      }
    }
    return merged;
  }

  /** Number of registered handlers for an event. Useful for tests
   *  and for hosts that want to gate UI affordances on "does any
   *  plugin care about this event". */
  function count(event) {
    if (!HOOK_EVENTS.includes(event)) {
      throw new Error(`Unknown hook event: ${event}`);
    }
    return handlers[event].length;
  }

  return Object.freeze({ fire, count, EVENTS: HOOK_EVENTS });
}
