import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Phase 3 (3.9): unit-test the travel FSM — transitions, segment count, event
// probability, fast-travel safety, and termination. travel.js is pure so we
// import the REAL module.
// Travel now lives in the client library; the app consumes it via the
// 'bag-of-holding-client' alias (esbuild). Test the vendored copy directly.
import {
  beginTravel, stepTravel, isTravelDone, pickEncounter, runTravel,
  TRAVEL_SEGMENTS_MIN, TRAVEL_SEGMENTS_MAX, ENCOUNTER_CHANCE, DISCOVERY_CHANCE, DISCOVERY_TYPES,
} from '../../vendor/bag-of-holding-client/src/travel/fsm.js';

// Deterministic RNG (same Mulberry32 the engine uses) for reproducible rolls.
function mulberry32(seed) {
  let state = (seed | 0) >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// A constant rng lets us pin the event branch precisely.
const constRng = (v) => () => v;

describe('beginTravel', () => {
  it('starts in departing with a segment count in range', () => {
    for (let s = 0; s < 50; s++) {
      const t = beginTravel('Ashvale', mulberry32(s));
      assert.equal(t.phase, 'departing');
      assert.equal(t.segment, 0);
      assert.ok(t.segments >= TRAVEL_SEGMENTS_MIN && t.segments <= TRAVEL_SEGMENTS_MAX, `segments ${t.segments}`);
      assert.equal(t.destination, 'Ashvale');
      assert.equal(isTravelDone(t), false);
    }
  });
});

describe('stepTravel — phase progression', () => {
  it('departing → traveling → … → arriving → arrived', () => {
    let t = beginTravel('Dest', constRng(0.99)); // 0.99 → uneventful every segment
    const segs = t.segments;
    let r = stepTravel(t, constRng(0.99));
    assert.equal(r.event.type, 'depart');
    assert.equal(r.travel.phase, 'traveling');
    t = r.travel;
    for (let i = 0; i < segs; i++) {
      r = stepTravel(t, constRng(0.99));
      assert.equal(r.event.type, 'uneventful');
      t = r.travel;
    }
    assert.equal(t.phase, 'arriving');
    r = stepTravel(t, constRng(0.99));
    assert.equal(r.event.type, 'arrive');
    assert.equal(isTravelDone(r.travel), true);
  });

  it('does not mutate the input state', () => {
    const t = beginTravel('X', constRng(0.5));
    const before = JSON.parse(JSON.stringify(t));
    stepTravel(t, constRng(0.1));
    assert.deepEqual(t, before);
  });
});

describe('stepTravel — event rolls', () => {
  it('rolls an encounter when below ENCOUNTER_CHANCE', () => {
    let { travel } = stepTravel(beginTravel('X', constRng(0)), constRng(0)); // depart
    const r = stepTravel(travel, constRng(ENCOUNTER_CHANCE - 0.01));
    assert.equal(r.event.type, 'encounter');
  });
  it('rolls a discovery in the discovery band', () => {
    let { travel } = stepTravel(beginTravel('X', constRng(0)), constRng(0));
    const mid = ENCOUNTER_CHANCE + DISCOVERY_CHANCE - 0.01;
    const r = stepTravel(travel, constRng(mid));
    assert.equal(r.event.type, 'discovery');
    assert.ok(DISCOVERY_TYPES.includes(r.event.discovery));
  });
  it('is uneventful above both bands', () => {
    let { travel } = stepTravel(beginTravel('X', constRng(0)), constRng(0));
    const r = stepTravel(travel, constRng(0.999));
    assert.equal(r.event.type, 'uneventful');
  });
});

describe('fast travel (safe mode)', () => {
  it('never produces an encounter or discovery', () => {
    const { events } = runTravel('Home', mulberry32(7), { safe: true });
    const kinds = new Set(events.map(e => e.type));
    assert.ok(!kinds.has('encounter'), 'no encounters in safe mode');
    assert.ok(!kinds.has('discovery'), 'no discoveries in safe mode');
    assert.ok(kinds.has('arrive'), 'still arrives');
  });
});

describe('runTravel — always terminates with an arrival', () => {
  it('produces depart … arrive across many seeds', () => {
    for (let s = 0; s < 100; s++) {
      const { travel, events } = runTravel('Dest', mulberry32(s));
      assert.equal(isTravelDone(travel), true);
      assert.equal(events[0].type, 'depart');
      assert.equal(events[events.length - 1].type, 'arrive');
      // Exactly `segments` non-depart/arrive events between the bookends.
      const middle = events.slice(1, -1);
      assert.equal(middle.length, travel.segments);
    }
  });
});

describe('pickEncounter', () => {
  it('picks from the supplied pool', () => {
    const pool = ['goblin', 'wolf', 'skeleton'];
    for (let s = 0; s < 20; s++) {
      assert.ok(pool.includes(pickEncounter(pool, mulberry32(s))));
    }
  });
  it('returns null for an empty pool', () => {
    assert.equal(pickEncounter([], mulberry32(1)), null);
    assert.equal(pickEncounter(null, mulberry32(1)), null);
  });
});
