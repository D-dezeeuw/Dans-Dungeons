// Travel-encounter world swap — the save-bricking defect.
//
// Symptom: autosave runs every combat turn, so closing the tab during a road
// encounter persisted a world whose currentRoom/rooms/npcs/location were the
// encounter's, while the REAL values lived only in a local variable. On reload
// the game resumed into that half-world, the victory gate fired with no caller
// to return to, and the run was unrecoverable on every later reload too.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  encounterSnapshot, enterEncounterState, exitEncounterState, isInEncounter, ENCOUNTER_FIELDS,
} from '../src/game/encounter-state.js';

const townWorld = () => ({
  currentRoom: 'room-a',
  exitRoomId:  'room-vault',
  rooms:       { 'room-a': { id: 'room-a' }, 'room-vault': { id: 'room-vault' } },
  npcs:        { 'goblin-1': { id: 'goblin-1', alive: true } },
  location:    { type: 'settlement', settlementId: 'saltmarch', regionId: 'r1' },
  settlements: { saltmarch: { id: 'saltmarch', name: 'Saltmarch' } },
  redThread:   { beats: [], currentIndex: 0, flags: {} },
});

const wolf = { room: { id: 'encounter', name: 'The road' }, npcs: { 'enc-1': { id: 'enc-1', alive: true } } };

describe('entering an encounter', () => {
  it('borrows the combat fields and remembers all of them', () => {
    const before = townWorld();
    const during = enterEncounterState(before, wolf);

    assert.equal(during.currentRoom, 'encounter');
    assert.equal(during.exitRoomId, 'encounter');
    assert.equal(during.location.type, 'encounter');
    assert.ok(during.npcs['enc-1']);
    for (const f of ENCOUNTER_FIELDS) {
      assert.deepEqual(during.encounterReturn[f], before[f], `${f} must be recoverable`);
    }
  });

  it('keeps campaign data outside the swap untouched', () => {
    const during = enterEncounterState(townWorld(), wolf);
    assert.deepEqual(during.settlements, townWorld().settlements);
    assert.deepEqual(during.redThread, townWorld().redThread);
  });

  it('keeps the settlement id so a resumed fight knows where to go home to', () => {
    const during = enterEncounterState(townWorld(), wolf);
    assert.equal(during.location.settlementId, 'saltmarch');
  });

  it('never overwrites the way home if an encounter nests', () => {
    const first  = enterEncounterState(townWorld(), wolf);
    const second = enterEncounterState(first, wolf);
    assert.equal(second.encounterReturn.currentRoom, 'room-a',
      'a nested encounter must not record the encounter itself as the return point');
  });
});

describe('leaving an encounter', () => {
  it('round-trips the world back to exactly what it was', () => {
    const before = townWorld();
    const after  = exitEncounterState(enterEncounterState(before, wolf));
    assert.deepEqual(after, before);
  });

  it('drops the marker so the save no longer looks mid-fight', () => {
    const after = exitEncounterState(enterEncounterState(townWorld(), wolf));
    assert.equal(after.encounterReturn, undefined);
    assert.equal(isInEncounter(after), false);
  });

  it('is idempotent — restoring twice is harmless', () => {
    const once  = exitEncounterState(enterEncounterState(townWorld(), wolf));
    assert.deepEqual(exitEncounterState(once), once);
  });
});

describe('reload mid-encounter', () => {
  it('a persisted encounter world is detectable and recoverable', () => {
    // Simulate the autosave: serialize the borrowed world, drop every in-memory
    // reference, reload from JSON — the pre-encounter world must still be there.
    const during = enterEncounterState(townWorld(), wolf);
    const loaded = JSON.parse(JSON.stringify(during));

    assert.ok(isInEncounter(loaded), 'resume must be able to route into the fight');
    assert.deepEqual(exitEncounterState(loaded), townWorld(),
      'the pre-encounter world must survive a save/load cycle');
  });

  it('snapshot covers every field the swap overwrites', () => {
    const before = townWorld();
    const during = enterEncounterState(before, wolf);
    const changed = Object.keys(before).filter(k => during[k] !== before[k]);
    for (const k of changed) {
      assert.ok(ENCOUNTER_FIELDS.includes(k),
        `field '${k}' is modified on entry but is not in the restore snapshot`);
    }
  });
});
