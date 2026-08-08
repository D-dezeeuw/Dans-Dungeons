// tests/slots.test.js — named save slots.
//
// Pure: the module takes a storage adapter, so the whole thing runs against a
// Map without a browser. What matters is that a slot is the SAME save the
// autosave writes — same envelope, same version, same migration path — because
// a second kind of save is a second set of save bugs.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  slotId, listSlots, saveSlot, readSlot, deleteSlot, slotBytes, MAX_SLOTS,
} from '../src/core/slots.js';
import { wrapEnvelope, loadEnvelope } from '../vendor/bag-of-holding-client/index.js';

function store() {
  const m = new Map();
  return {
    _m: m,
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, v),
    removeItem: k => m.delete(k),
  };
}

const V = 2;
const MIGRATIONS = { 0: d => d, 1: d => d };
// The caller (state.js) is what wraps and unwraps; these two mirror what it
// does, so the tests exercise a slot end to end without importing Spektrum.
const write = (data, version = V) => JSON.stringify(wrapEnvelope(data, version));
const load  = (s, id) => {
  const raw = readSlot(s, id);
  return raw == null ? null : loadEnvelope(raw, { migrations: MIGRATIONS, currentVersion: V });
};

describe('slot ids', () => {
  it('derives a stable id from a name', () => {
    assert.equal(slotId('Before the Vault'), 'before-the-vault');
    assert.equal(slotId('Before the Vault'), slotId('before the vault'));
  });

  it('survives punctuation, accents and length', () => {
    assert.equal(slotId('  ¡Vámonos!  '), 'v-monos');
    assert.equal(slotId('!!!'), 'slot');
    assert.ok(slotId('x'.repeat(200)).length <= 40);
  });
});

describe('saving and loading', () => {
  it('round-trips through the same envelope the autosave uses', () => {
    const s = store();
    const res = saveSlot(s, 'Camp', write({ hp: 12, world: { name: 'Ash' } }));
    assert.equal(res.ok, true);
    assert.deepEqual(load(s, res.id), { hp: 12, world: { name: 'Ash' } });

    // …and it IS an envelope, readable by loadEnvelope directly.
    const raw = s.getItem(`dans-dungeons-slot-${res.id}`);
    assert.deepEqual(JSON.parse(raw), wrapEnvelope({ hp: 12, world: { name: 'Ash' } }, V));
  });

  it('runs the migration chain on load, like a reload does', () => {
    const s = store();
    s.setItem('dans-dungeons-slot-old', write({ hp: 1 }, 1));
    const out = loadEnvelope(readSlot(s, 'old'), {
      migrations: { 1: d => ({ ...d, migrated: true }) }, currentVersion: 2,
    });
    assert.deepEqual(out, { hp: 1, migrated: true });
  });

  it('refuses a slot from a newer build rather than loading it raw', () => {
    const s = store();
    s.setItem('dans-dungeons-slot-future', write({ hp: 1 }, 99));
    assert.equal(load(s, 'future'), null);
  });

  it('returns null for a slot that is not there', () => {
    assert.equal(load(store(), 'nope'), null);
  });

  it('refuses an empty name', () => {
    const res = saveSlot(store(), '   ', write({ hp: 1 }));
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'empty-name');
  });
});

describe('the index', () => {
  it('lists slots newest first with their metadata', () => {
    const s = store();
    saveSlot(s, 'First',  write({ a: 1 }), { turn: 3,  pc: 'Ryn' });
    saveSlot(s, 'Second', write({ a: 2 }), { turn: 40, pc: 'Ryn' });
    const list = listSlots(s);
    assert.equal(list.length, 2);
    assert.equal(list[0].name, 'Second');
    assert.equal(list[0].turn, 40);
    assert.equal(list[0].pc, 'Ryn');
  });

  it('saving the same name twice overwrites instead of accumulating', () => {
    const s = store();
    saveSlot(s, 'Camp', write({ hp: 1 }));
    saveSlot(s, 'Camp', write({ hp: 2 }));
    assert.equal(listSlots(s).length, 1);
    assert.deepEqual(load(s, slotId('Camp')), { hp: 2 });
  });

  it('caps the number of slots', () => {
    const s = store();
    for (let i = 0; i < MAX_SLOTS; i++) assert.equal(saveSlot(s, `Slot ${i}`, write({ i })).ok, true);
    const overflow = saveSlot(s, 'One too many', write({ i: 99 }));
    assert.equal(overflow.ok, false);
    assert.equal(overflow.reason, 'full');
    assert.equal(listSlots(s).length, MAX_SLOTS);
  });

  it('overwriting an existing slot works even when full', () => {
    const s = store();
    for (let i = 0; i < MAX_SLOTS; i++) saveSlot(s, `Slot ${i}`, write({ i }));
    assert.equal(saveSlot(s, 'Slot 0', write({ i: 'new' })).ok, true);
    assert.deepEqual(load(s, slotId('Slot 0')), { i: 'new' });
  });

  it('deleting frees the name and the bytes', () => {
    const s = store();
    const { id } = saveSlot(s, 'Camp', write({ hp: 1 }));
    assert.ok(slotBytes(s) > 0);
    deleteSlot(s, id);
    assert.deepEqual(listSlots(s), []);
    assert.equal(load(s, id), null);
    assert.equal(slotBytes(s), 0);
  });

  it('survives a corrupt index rather than throwing', () => {
    const s = store();
    s.setItem('dans-dungeons-slots', 'not json{');
    assert.deepEqual(listSlots(s), []);
    assert.equal(saveSlot(s, 'Camp', write({ hp: 1 })).ok, true);
  });
});

describe('storage failures are reported, never swallowed', () => {
  it('says quota when the write is refused', () => {
    const s = store();
    s.setItem = () => { throw new Error('QuotaExceededError'); };
    const res = saveSlot(s, 'Camp', write({ hp: 1 }));
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'quota');
  });

  it('does not add an index entry for a slot that failed to write', () => {
    const m = new Map();
    const s = {
      getItem: k => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => { if (k.startsWith('dans-dungeons-slot-')) throw new Error('nope'); m.set(k, v); },
      removeItem: k => m.delete(k),
    };
    saveSlot(s, 'Camp', write({ hp: 1 }));
    assert.deepEqual(listSlots(s), [], 'the index must not list a slot whose bytes were never written');
  });

  it('a storage that throws on read degrades to no slots', () => {
    const s = { getItem: () => { throw new Error('blocked'); }, setItem: () => {}, removeItem: () => {} };
    assert.deepEqual(listSlots(s), []);
    assert.equal(readSlot(s, 'x'), null);
    assert.equal(slotBytes(s), 0);
  });
});
