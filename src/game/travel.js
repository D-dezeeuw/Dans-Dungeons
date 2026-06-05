// src/game/travel.js — pure overworld travel state machine.
//
// Zero imports: the FSM, segment generation, and per-segment event rolls are
// pure functions of their args (an injected rng + a creature/discovery pool) so
// they're unit-testable in the node test runner. flow.js drives the machine,
// narrating each step and handing combat encounters to the existing turn loop.
//
// Phases: departing → traveling (N segments) → arriving → arrived.
// Each `traveling` step rolls one event: an encounter, a discovery, or nothing.

export const TRAVEL_SEGMENTS_MIN = 2;
export const TRAVEL_SEGMENTS_MAX = 3;
export const ENCOUNTER_CHANCE    = 0.4;   // per traveling segment
export const DISCOVERY_CHANCE     = 0.35;  // per traveling segment (after encounter roll)

export const DISCOVERY_TYPES = ['loot', 'wanderer', 'shrine', 'clue'];

// Initial travel state toward `destination`. `rng` picks the segment count.
export function beginTravel(destination, rng = Math.random) {
  const span     = TRAVEL_SEGMENTS_MAX - TRAVEL_SEGMENTS_MIN + 1;
  const segments = TRAVEL_SEGMENTS_MIN + Math.floor(rng() * span);
  return { phase: 'departing', destination, segment: 0, segments, log: [], done: false };
}

export function isTravelDone(travel) {
  return !travel || travel.phase === 'arrived' || travel.done === true;
}

// Advance the machine one step. Returns { travel, event } where event.type is
// one of: depart, encounter, discovery, uneventful, arrive. Pure — never
// mutates the input. `opts.safe` (fast travel) suppresses encounters/discoveries.
export function stepTravel(travel, rng = Math.random, opts = {}) {
  const t = { ...travel, log: [...(travel.log ?? [])] };

  if (t.phase === 'departing') {
    t.phase = 'traveling';
    return { travel: t, event: { type: 'depart', destination: t.destination } };
  }

  if (t.phase === 'traveling') {
    t.segment += 1;
    let event;
    if (opts.safe) {
      event = { type: 'uneventful' };
    } else {
      const roll = rng();
      if (roll < ENCOUNTER_CHANCE) {
        event = { type: 'encounter' };
      } else if (roll < ENCOUNTER_CHANCE + DISCOVERY_CHANCE) {
        const d = DISCOVERY_TYPES[Math.floor(rng() * DISCOVERY_TYPES.length)];
        event = { type: 'discovery', discovery: d };
      } else {
        event = { type: 'uneventful' };
      }
    }
    t.log.push(event.type === 'discovery' ? `discovery:${event.discovery}` : event.type);
    if (t.segment >= t.segments) t.phase = 'arriving';
    return { travel: t, event };
  }

  if (t.phase === 'arriving') {
    t.phase = 'arrived';
    t.done = true;
    return { travel: t, event: { type: 'arrive', destination: t.destination } };
  }

  // Already arrived — idempotent.
  return { travel: { ...t, done: true }, event: { type: 'arrive', destination: t.destination } };
}

// Pick a creature id from a caller-supplied pool (kept pure — flow.js supplies
// the region/theme-appropriate ids so travel.js needs no bestiary import).
export function pickEncounter(pool, rng = Math.random) {
  if (!pool || !pool.length) return null;
  return pool[Math.floor(rng() * pool.length)];
}

// Run the whole machine to completion, collecting the event list. Handy for
// tests and for previewing a fast-travel route.
export function runTravel(destination, rng = Math.random, opts = {}) {
  let travel = beginTravel(destination, rng);
  const events = [];
  // Guard the loop against a pathological rng with a generous cap.
  for (let i = 0; i < 64 && !isTravelDone(travel); i++) {
    const res = stepTravel(travel, rng, opts);
    travel = res.travel;
    events.push(res.event);
  }
  return { travel, events };
}
