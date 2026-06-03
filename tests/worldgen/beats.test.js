import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Beat schema contract', () => {
  const beat1 = {
    id: 'beat.01.the-hook',
    dramaticPurpose: 'The player discovers the first sign of the threat.',
    targetPlaytimeMinutes: 45,
    prerequisites: [],
    setRequiredFlags: ['flag.threat-discovered'],
    preferredLocation: null,
    requiredArchetypes: [
      { role: 'informant', notes: 'a villager who witnessed the event' },
    ],
    successors: [],
  };

  const beat2 = {
    id: 'beat.02.the-revelation',
    dramaticPurpose: 'The player learns the true scope of the threat.',
    targetPlaytimeMinutes: 60,
    prerequisites: ['flag.threat-discovered'],
    setRequiredFlags: ['flag.scope-known'],
    preferredLocation: null,
    requiredArchetypes: [
      { role: 'mentor', notes: 'a sage or elder who explains the history' },
    ],
    successors: [],
  };

  const beat3 = {
    id: 'beat.03.the-climax',
    dramaticPurpose: 'The player confronts the source of the threat.',
    targetPlaytimeMinutes: 90,
    prerequisites: ['flag.scope-known'],
    setRequiredFlags: ['flag.threat-resolved'],
    preferredLocation: null,
    requiredArchetypes: [
      { role: 'antagonist', notes: 'the entity behind the threat' },
      { role: 'authority', notes: 'the ruler whose domain is at stake' },
    ],
    successors: [],
  };

  it('beats form a valid flag chain', () => {
    // Beat 1 sets flags that beat 2 requires, beat 2 sets flags that beat 3 requires.
    const flagsSet = new Set();
    const beats = [beat1, beat2, beat3];

    for (const beat of beats) {
      // All prerequisites must be set by a previous beat.
      for (const pre of beat.prerequisites) {
        assert.ok(flagsSet.has(pre), `beat ${beat.id} requires '${pre}' but it hasn't been set yet`);
      }
      // Set the flags this beat provides.
      for (const flag of beat.setRequiredFlags) {
        flagsSet.add(flag);
      }
    }
  });

  it('first beat has no prerequisites', () => {
    assert.deepEqual(beat1.prerequisites, []);
  });

  it('beats escalate in playtime', () => {
    assert.ok(beat3.targetPlaytimeMinutes >= beat1.targetPlaytimeMinutes);
  });

  it('archetype roles are from the vocabulary', () => {
    const ROLES = ['authority', 'antagonist', 'informant', 'mentor', 'fixer', 'muscle', 'herald'];
    for (const beat of [beat1, beat2, beat3]) {
      for (const arch of beat.requiredArchetypes) {
        assert.ok(ROLES.includes(arch.role), `unknown role '${arch.role}' in beat ${beat.id}`);
      }
    }
  });

  it('beat IDs are unique', () => {
    const ids = [beat1, beat2, beat3].map(b => b.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('successors are empty in v1 (linear)', () => {
    for (const beat of [beat1, beat2, beat3]) {
      assert.deepEqual(beat.successors, []);
    }
  });
});

describe('Red thread state contract', () => {
  it('world.redThread has correct shape', () => {
    const redThread = {
      beats: [],
      currentIndex: 0,
      flags: {},
    };
    assert.ok(Array.isArray(redThread.beats));
    assert.equal(typeof redThread.currentIndex, 'number');
    assert.equal(typeof redThread.flags, 'object');
  });

  it('advancing sets currentIndex and flags', () => {
    const state = {
      beats: [
        { id: 'b1', setRequiredFlags: ['f1'], prerequisites: [] },
        { id: 'b2', setRequiredFlags: ['f2'], prerequisites: ['f1'] },
      ],
      currentIndex: 0,
      flags: {},
    };

    // Simulate completing beat 1.
    for (const f of state.beats[0].setRequiredFlags) state.flags[f] = true;
    state.currentIndex = 1;

    assert.equal(state.flags.f1, true);
    assert.equal(state.currentIndex, 1);

    // Beat 2 prerequisites are met.
    const beat2 = state.beats[1];
    const ready = beat2.prerequisites.every(f => state.flags[f] === true);
    assert.ok(ready);
  });
});
