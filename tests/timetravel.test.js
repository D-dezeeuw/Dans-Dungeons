import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// The "undo last turn" feature (src/game/undo.js) rests on Spektrum's
// time-travel primitive: capture a history index before a turn's writes, then
// replay() back to it to revert everything that turn touched. The wiring needs
// a DOM, but the underlying contract is pure — pin it here against the vendored
// engine so a future Spektrum vendor bump can't silently break undo.
import { createSpektrum } from '../vendor/spektrum.js';

// Mirror src/game/undo.js: mark = history length before the turn, checkpoint
// for the log, then the turn's mutations. undo = replay(mark).
function markTurn(sp, label) {
  const mark = sp.history.length;
  sp.checkpoint(label);
  return mark;
}

describe('time-travel undo round-trip (vendored Spektrum)', () => {
  it('replay(mark) restores the exact pre-turn state', () => {
    const sp = createSpektrum();
    sp.setValue('party.pc.record.hpCurrent', 30);
    sp.setValue('world.currentRoom', 'room-0');
    sp.setValue('session.turnCount', 4);
    sp.setValue('transcript', [{ role: 'gm', text: 'You enter.', turn: 4 }]);
    sp.tick();

    const mark = markTurn(sp, 'turn:4');

    // A turn's worth of mutations: take damage, move, append transcript, tick.
    sp.setValue('party.pc.record.hpCurrent', 12);
    sp.setValue('world.currentRoom', 'room-1');
    sp.addValue('session.turnCount', 1);
    sp.setValue('transcript', [
      ...sp.appState.transcript,
      { role: 'player', text: 'go north', turn: 4 },
      { role: 'gm',     text: 'A goblin strikes!', turn: 5 },
    ]);
    sp.tick();

    // Sanity: the turn landed.
    assert.equal(sp.appState.party.pc.record.hpCurrent, 12);
    assert.equal(sp.appState.world.currentRoom, 'room-1');
    assert.equal(sp.appState.session.turnCount, 5);
    assert.equal(sp.appState.transcript.length, 3);

    // Undo.
    sp.replay(mark);

    assert.equal(sp.appState.party.pc.record.hpCurrent, 30);
    assert.equal(sp.appState.world.currentRoom, 'room-0');
    assert.equal(sp.appState.session.turnCount, 4);
    assert.equal(sp.appState.transcript.length, 1);
    assert.equal(sp.appState.transcript[0].text, 'You enter.');
  });

  it('successive marks undo one turn at a time (LIFO)', () => {
    const sp = createSpektrum();
    sp.setValue('session.turnCount', 0);
    sp.tick();

    const marks = [];
    for (let turn = 0; turn < 3; turn++) {
      marks.push(markTurn(sp, `turn:${turn}`));
      sp.addValue('session.turnCount', 1);
      sp.tick();
    }
    assert.equal(sp.appState.session.turnCount, 3);

    sp.replay(marks.pop());               // undo turn 2
    assert.equal(sp.appState.session.turnCount, 2);
    sp.replay(marks.pop());               // undo turn 1
    assert.equal(sp.appState.session.turnCount, 1);
    sp.replay(marks.pop());               // undo turn 0
    assert.equal(sp.appState.session.turnCount, 0);
  });

  it('a checkpoint contributes no state — replay past it is a no-op', () => {
    const sp = createSpektrum();
    sp.setValue('session.turnCount', 7);
    sp.tick();
    const before = sp.history.length;
    sp.checkpoint('turn:7');
    sp.replay(sp.history.length);         // replay including the checkpoint
    assert.equal(sp.appState.session.turnCount, 7);
    assert.equal(sp.history.length, before + 1); // checkpoint recorded, state unchanged
  });
});

// Model src/game/undo.js's context-scoped, deferred-mark design (the real module
// imports the DOM + the Spektrum singleton, so the pure decision logic is mirrored
// here against an engine instance). Locks the guards that fixed the pre-deploy
// review's cross-context-corruption blockers.
function makeUndo(sp) {
  const marks = [];
  const sig = () => {
    const loc = sp.appState.world?.location ?? {};
    return `${loc.type ?? ''}|${loc.dungeonId ?? ''}|${loc.settlementId ?? ''}`;
  };
  return {
    marks,
    beginTurn: () => sp.appState.world?.location?.type === 'encounter'
      ? null : { index: sp.history.length, sig: sig() },
    finalizeTurn: (m) => { if (m) marks.push(m); },           // only after a committed turn
    clear: () => { marks.length = 0; },                        // end state / context transition
    undo: () => {
      if (!marks.length) return false;
      if (marks[marks.length - 1].sig !== sig()) { marks.length = 0; return false; } // stale context
      sp.replay(marks.pop().index);
      return true;
    },
  };
}

describe('undo context-scoping + deferred mark (mirrors src/game/undo.js)', () => {
  it('a turn that throws before commit registers no mark (deferred finalize)', () => {
    const sp = createSpektrum();
    sp.setValue('world.location', { type: 'dungeon', dungeonId: 'd1' });
    sp.setValue('session.turnCount', 1);
    sp.tick();
    const u = makeUndo(sp);
    u.beginTurn();                 // mark captured…
    /* turn body throws here → finalizeTurn never called */
    assert.equal(u.marks.length, 0);
    assert.equal(u.undo(), false); // nothing to undo, no phantom affordance
  });

  it('refuses + drops stale marks when the play context changed (dungeon → settlement)', () => {
    const sp = createSpektrum();
    sp.setValue('world.location', { type: 'dungeon', dungeonId: 'd1' });
    sp.setValue('world.currentRoom', 'room-2');
    sp.tick();
    const u = makeUndo(sp);
    const m = u.beginTurn();
    sp.setValue('world.currentRoom', 'room-3');   // a dungeon turn
    sp.tick();
    u.finalizeTurn(m);
    assert.equal(u.marks.length, 1);

    sp.setValue('world.location', { type: 'settlement', settlementId: 's1', dungeonId: null }); // world swap
    sp.tick();
    assert.equal(u.undo(), false);                 // refused
    assert.equal(u.marks.length, 0);               // stale marks dropped
    assert.equal(sp.appState.world.currentRoom, 'room-3'); // state NOT rewound from town
  });

  it('takes no mark inside a transient encounter', () => {
    const sp = createSpektrum();
    sp.setValue('world.location', { type: 'encounter' });
    sp.tick();
    const u = makeUndo(sp);
    assert.equal(u.beginTurn(), null);
    u.finalizeTurn(u.beginTurn());
    assert.equal(u.marks.length, 0);
  });

  it('after an end state clears marks, undo is a no-op (cannot resurrect a finished run)', () => {
    const sp = createSpektrum();
    sp.setValue('world.location', { type: 'dungeon', dungeonId: 'd1' });
    sp.setValue('session.phase', 'play');
    sp.tick();
    const u = makeUndo(sp);
    const m = u.beginTurn();
    sp.setValue('session.phase', 'game-over');   // the killing-blow turn
    sp.tick();
    u.finalizeTurn(m);
    u.clear();                                    // awaitRestart() / end state drops the marks
    assert.equal(u.undo(), false);
    assert.equal(sp.appState.session.phase, 'game-over'); // run NOT rewound to 'play'
  });

  it('undoes a room move within one dungeon (same context)', () => {
    const sp = createSpektrum();
    sp.setValue('world.location', { type: 'dungeon', dungeonId: 'd1' });
    sp.setValue('world.currentRoom', 'room-1');
    sp.tick();
    const u = makeUndo(sp);
    const m = u.beginTurn();
    sp.setValue('world.currentRoom', 'room-2');   // moved rooms, same dungeon
    sp.tick();
    u.finalizeTurn(m);
    assert.equal(u.undo(), true);
    assert.equal(sp.appState.world.currentRoom, 'room-1'); // move undone
  });
});
