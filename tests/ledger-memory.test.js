// The memory loop, end to end: what the Game Master says becomes true, stays
// true, and can never overrule the dice.
//
// This is the property the whole 80-hour goal rests on. Before the ledger, a
// detail the GM invented lived in the transcript until it scrolled out of a
// three-entry window; revisiting the same hall produced a different room.
//
// Mirrors the game's wiring against the vendored library rather than importing
// src/game/ledger.js, which binds the Spektrum singleton at import time (the
// repo's mirror-testing convention — see seeded-rolls.test.js).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  makePatch, appendPatch, fold, foldAll, recentCauses, compact, makeId,
} from '../vendor/bag-of-holding-client/index.js';

const HALL     = 'region.emberfen.castle.room.hall';
const CURTAINS = `${HALL}.detail.curtains`;
const INN      = 'region.emberfen.settlement.farstay.inn';
const GHOUL    = `${INN}.creature.privy-ghoul`;

// A tiny harness mirroring src/game/ledger.js + canon-commit.js.
function world() {
  let ledger = [];
  let bases  = {};
  let rejected = 0;
  const record = (fields) => {
    const res = appendPatch(ledger, makePatch({ turn: fields.turn ?? 1, ...fields }));
    if (!res.ok) { rejected++; return false; }
    ledger = res.ledger;
    return true;
  };
  return {
    canon:      (target, path, to, o = {}) => record({ target, path, to, kind: 'canon', ...o }),
    mechanical: (target, path, to, o = {}) => record({ target, path, to, kind: 'mechanical', ...o }),
    entity:     (id) => fold(bases[id], ledger, id),
    under:      (prefix) => foldAll(bases, ledger, prefix),
    causes:     (o) => recentCauses(ledger, o),
    compactTo:  (turn) => { const r = compact(bases, ledger, { beforeTurn: turn }); bases = r.bases; ledger = r.ledger; return r.foldedCount; },
    get rejected() { return rejected; },
    get size()     { return ledger.length; },
  };
}

describe('the moldy curtains', () => {
  it('a detail the GM invents survives hundreds of unrelated turns', () => {
    const w = world();
    // Turn 3: the narrator mentions mould. The extractor mints the detail.
    w.canon(CURTAINS, 'name', 'moth-eaten curtains', { turn: 3, because: 'the GM described them' });
    w.canon(CURTAINS, 'condition', 'mould creeps up the fabric', { turn: 3, because: 'damp in the hall' });

    // 400 turns elsewhere.
    for (let turn = 4; turn < 404; turn++) {
      w.mechanical('region.emberfen.castle.pc', 'hpCurrent', 20 - (turn % 7), { turn });
    }

    const still = w.entity(CURTAINS);
    assert.match(still.condition, /mould/);
    assert.equal(still.name, 'moth-eaten curtains');
  });

  it('is served back with the room, so the next visit matches the last', () => {
    const w = world();
    w.canon(CURTAINS, 'condition', 'mould creeps up the fabric', { turn: 3 });
    w.canon(`${HALL}.detail.bell`, 'condition', 'cracked, silent', { turn: 5 });

    const here = w.under(HALL);
    const details = Object.keys(here).filter(id => id.includes('.detail.'));
    assert.equal(details.length, 2, 'both remembered features come back with the hall');
  });

  it('can be changed by later events without losing its history', () => {
    const w = world();
    w.canon(CURTAINS, 'condition', 'mould creeps up the fabric', { turn: 3 });
    w.mechanical(CURTAINS, 'condition', 'burned away', { turn: 60, because: 'the party set the hall alight' });
    assert.equal(w.entity(CURTAINS).condition, 'burned away');
    assert.ok(w.causes({ limit: 5 }).some(c => /alight/.test(c.because)));
  });
});

describe('the ghoul of the FarStay Inn', () => {
  it('a GM-invented threat becomes fightable and remembered', () => {
    const w = world();
    // The narrator improvises a ghoul in the privy; minting binds it to a real
    // stat block so the deterministic layer can run the fight it implied.
    const id = makeId(INN, 'creature', 'privy ghoul');
    assert.equal(id, GHOUL);
    w.canon(id, 'name', 'the privy ghoul', { turn: 12, because: 'the GM introduced it' });
    w.mechanical(id, 'creatureId', 'ghoul', { turn: 12, because: 'bound to a stat block' });
    w.mechanical(id, 'alive', true, { turn: 12 });
    w.canon(id, 'state', 'active-threat', { turn: 12, scope: 'regional', because: 'it is terrorising the inn' });
    w.mechanical(id, 'clock', { segments: 4, filled: 0 }, { turn: 12, scope: 'regional' });

    const g = w.entity(GHOUL);
    assert.equal(g.creatureId, 'ghoul', 'the rules engine can run this creature');
    assert.equal(g.alive, true);
    assert.equal(g.clock.filled, 0);
  });

  it('escalates while ignored, and the region hears about it', () => {
    const w = world();
    w.mechanical(GHOUL, 'clock', { segments: 4, filled: 0 }, { turn: 12, scope: 'regional' });
    for (let n = 1; n <= 4; n++) {
      w.mechanical(GHOUL, 'clock', { segments: 4, filled: n }, {
        turn: 12 + n * 20, scope: 'regional',
        because: `the ghoul of the FarStay Inn went unanswered (${n}/4)`,
      });
    }
    assert.equal(w.entity(GHOUL).clock.filled, 4, 'ignoring a threat has consequences');
    const heard = w.causes({ minScope: 'regional', limit: 10 });
    assert.ok(heard.some(c => /FarStay/.test(c.because)), 'the region can talk about it');
  });

  it('is resolvable, and the resolution is what gets remembered', () => {
    const w = world();
    w.mechanical(GHOUL, 'alive', true, { turn: 12 });
    w.mechanical(GHOUL, 'alive', false, {
      turn: 88, scope: 'regional',
      because: 'the party finally cornered the ghoul in the privy and destroyed it',
    });
    assert.equal(w.entity(GHOUL).alive, false);
    assert.ok(w.causes({ limit: 3 }).some(c => /destroyed it/.test(c.because)),
      'the journal and the epilogue can cite this');
  });

  it('a re-told rumour does not create a second ghoul', () => {
    const w = world();
    w.canon(GHOUL, 'name', 'the privy ghoul', { turn: 12 });
    // Minting dedups by id, and the id is derived from the name + parent.
    assert.equal(makeId(INN, 'creature', 'Privy Ghoul'), GHOUL);
    assert.equal(Object.keys(w.under(INN)).length, 1);
  });
});

describe('precedence — colour never overwrites truth', () => {
  it('refuses a narration that un-wounds a wounded enemy', () => {
    const w = world();
    w.mechanical(GHOUL, 'hp', 3, { turn: 20, because: 'struck for 8' });
    const ok = w.canon(GHOUL, 'hp', 22, { turn: 20, because: 'the GM said it looked unhurt' });
    assert.equal(ok, false);
    assert.equal(w.entity(GHOUL).hp, 3);
    assert.equal(w.rejected, 1, 'rejections are counted as a narrator-quality signal');
  });

  it('still accepts colour on fields the dice never touched', () => {
    const w = world();
    w.mechanical(GHOUL, 'hp', 3, { turn: 20 });
    assert.equal(w.canon(GHOUL, 'mood', 'cornered and shrieking', { turn: 20 }), true);
  });
});

describe('bounded growth over a long campaign', () => {
  it('compaction keeps the ledger small without changing what is true', () => {
    const w = world();
    w.canon(CURTAINS, 'condition', 'mould creeps up the fabric', { turn: 3 });
    w.mechanical(GHOUL, 'alive', false, { turn: 88, scope: 'regional', because: 'the party destroyed it' });
    for (let turn = 100; turn < 1100; turn++) {
      w.canon(`${HALL}.detail.dust`, 'condition', `disturbed ${turn}`, { turn });
    }
    const before = w.size;
    const folded = w.compactTo(1000);

    assert.ok(folded > 800, 'stale local detail is folded away');
    assert.ok(w.size < before / 5, 'the ledger shrinks substantially');
    assert.match(w.entity(CURTAINS).condition, /mould/, 'old detail survives in base');
    assert.equal(w.entity(GHOUL).alive, false, 'regional history is never dropped');
  });
});
