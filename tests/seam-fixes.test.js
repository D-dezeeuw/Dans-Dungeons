// Seam regressions from the 2026-08-09 post-implementation audit.
//
// Every fatal that audit found lived at a boundary the unit suites mock:
// Spektrum's deferred writes, the save-file boundary, the reload boundary.
// These tests run the REAL vendored Spektrum and the REAL client appendPatch
// against the REAL shipped primitives (utils.js is pure on purpose), so the
// exact failure modes — one surviving ledger patch per turn, a key inside
// _timeTravel.root — can never return silently.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { makeAppendCursor, stripSaveCredentials, stripCredentials } from '../src/core/utils.js';
import { createSpektrum } from '../vendor/spektrum.js';
import { appendPatch, makePatch } from '../vendor/bag-of-holding-client/index.js';

describe('ledger appends survive the deferred-write window (audit F1)', () => {
  // Replicates recordPatch's wiring: index from the cursor, write via
  // setValue, validation via appendPatch — against the real store semantics.
  function harness() {
    const s = createSpektrum();
    s.setValue('world.ledger', []);
    s.tick();
    const next = makeAppendCursor();
    const record = (fields) => {
      const patch = makePatch({ turn: 0, target: fields.target, path: fields.path, to: fields.to, kind: fields.kind ?? 'mechanical' });
      const current = s.appState.world?.ledger ?? [];
      const res = appendPatch(current, patch);
      if (!res.ok) return false;
      s.setValue(`world.ledger.${next(current.length)}`, patch);
      return true;
    };
    return { s, record };
  }

  it('keeps every patch of one synchronous window', () => {
    const { s, record } = harness();
    // The audit's probe: a mint writes name/creatureId/alive in one window.
    record({ target: 'region.x.creature.ghoul', path: 'name', to: 'Privy Ghoul', kind: 'canon' });
    record({ target: 'region.x.creature.ghoul', path: 'creatureId', to: 'ghoul' });
    record({ target: 'region.x.creature.ghoul', path: 'alive', to: true });
    s.tick();
    assert.equal(s.appState.world.ledger.length, 3,
      'three appends in one pre-tick window must yield three entries, not one');
    assert.deepEqual(s.appState.world.ledger.map(p => p.path), ['name', 'creatureId', 'alive']);
  });

  it('continues correctly across ticks and windows', () => {
    const { s, record } = harness();
    record({ target: 'a', path: 'p', to: 1 });
    record({ target: 'b', path: 'q', to: 2 });
    s.tick();
    record({ target: 'c', path: 'r', to: 3 });
    record({ target: 'd', path: 's', to: 4 });
    s.tick();
    assert.equal(s.appState.world.ledger.length, 4);
    assert.deepEqual(s.appState.world.ledger.map(p => p.target), ['a', 'b', 'c', 'd']);
  });

  it('resyncs after the array visibly rewinds (time travel)', () => {
    const { s, record } = harness();
    record({ target: 'a', path: 'p', to: 1 });
    record({ target: 'b', path: 'q', to: 2 });
    s.tick();
    // An undo rewound the ledger to one entry.
    s.setValue('world.ledger', [s.appState.world.ledger[0]]);
    s.tick();
    record({ target: 'c', path: 'r', to: 3 });
    s.tick();
    assert.equal(s.appState.world.ledger.length, 2);
    assert.equal(s.appState.world.ledger[1].target, 'c',
      'after a rewind the cursor must resync to the visible length, not leave holes');
  });
});

describe('credentials never leave in a save (audit S1)', () => {
  const snapshot = {
    session: { turnCount: 12 },
    ai: { key: 'sk-or-live-key', baseUrl: 'https://openrouter.ai/api/v1', tier: 'deluxe' },
    party: { pc: { record: { name: 'Tester' } } },
    _timeTravel: {
      spine: [],
      root: {
        session: { turnCount: 9 },
        ai: { key: 'sk-or-live-key', baseUrl: 'https://openrouter.ai/api/v1', tier: 'deluxe' },
        party: { pc: { record: { name: 'Tester' } } },
      },
    },
  };

  it('strips the top level AND the time-travel epoch root', () => {
    const out = stripSaveCredentials(snapshot);
    assert.equal(out.ai.key, undefined);
    assert.equal(out.ai.baseUrl, undefined);
    assert.equal(out._timeTravel.root.ai.key, undefined,
      'the epoch root is a full snapshot — the key was riding out inside it');
    assert.equal(out._timeTravel.root.ai.baseUrl, undefined,
      'an imported root baseUrl would redirect every future call');
    // Everything else must survive.
    assert.equal(out.ai.tier, 'deluxe');
    assert.equal(out._timeTravel.root.ai.tier, 'deluxe');
    assert.equal(out._timeTravel.root.party.pc.record.name, 'Tester');
    assert.equal(out.session.turnCount, 12);
  });

  it('the whole serialized text is credential-free', () => {
    const text = JSON.stringify(stripSaveCredentials(snapshot));
    assert.ok(!text.includes('sk-or-live-key'), 'no key anywhere in the serialized save');
  });

  it('does not mutate its input and handles snapshots without a blob', () => {
    stripSaveCredentials(snapshot);
    assert.equal(snapshot.ai.key, 'sk-or-live-key', 'input must be untouched');
    const bare = stripCredentials({ ai: { key: 'k', tier: 'free' } });
    assert.deepEqual(bare.ai, { tier: 'free' });
    assert.deepEqual(stripSaveCredentials({ world: {} }), { world: {} });
  });
});
