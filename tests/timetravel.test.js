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

// Phase 1 — the redo-capable cursor model that replaced the pop-stack. Mirrors
// the pure logic of src/game/undo.js (the real module also drives DOM + the
// Spektrum singleton); `_stops` is the ascending list of turn-boundary indices
// and `_pos` the position within it. NOTE the contract the real module leans on:
// no recorded write (setValue/addValue/checkpoint) may happen after replay(),
// because replay() leaves the cursor scrubbed back and the next record would
// fork away the redo tail — so these tests never write between a scrub and the
// next assertion, and the module drives button state imperatively.
function makeTimeTravel(sp) {
  let stops = [];
  let pos = 0;
  let epochSig = null;
  const sig = () => {
    const loc = sp.appState.world?.location ?? {};
    return `${loc.type ?? ''}|${loc.dungeonId ?? ''}|${loc.settlementId ?? ''}`;
  };
  const stale = () => { stops = []; pos = 0; epochSig = null; };
  return {
    get stops() { return stops; },
    get pos() { return pos; },
    canUndo: () => pos > 0,
    canRedo: () => pos < stops.length - 1,
    beginTurn: () => sp.appState.world?.location?.type === 'encounter'
      ? null : { index: sp.history.length, sig: sig() },
    finalizeTurn: (m) => {
      if (!m) return;
      if (!stops.length || epochSig !== m.sig) { epochSig = m.sig; stops = [m.index]; pos = 0; }
      else if (pos < stops.length - 1) { stops.length = pos + 1; }
      sp.checkpoint('turn');
      stops.push(sp.history.length);
      pos = stops.length - 1;
    },
    undo: () => {
      if (pos <= 0) return false;
      if (epochSig !== sig()) { stale(); return false; }
      pos -= 1; sp.replay(stops[pos]); return true;
    },
    redo: () => {
      if (pos >= stops.length - 1) return false;
      if (epochSig !== sig()) { stale(); return false; }
      pos += 1; sp.replay(stops[pos]); return true;
    },
    clear: stale,
  };
}

describe('time-travel undo/redo cursor model (mirrors src/game/undo.js Phase 1)', () => {
  function seed() {
    const sp = createSpektrum();
    sp.setValue('world.location', { type: 'dungeon', dungeonId: 'd1' });
    sp.setValue('party.pc.record.hpCurrent', 30);
    sp.setValue('world.currentRoom', 'room-0');
    sp.setValue('session.turnCount', 0);
    sp.setValue('transcript', []);
    sp.tick();
    return sp;
  }
  function play(sp, tt, { hp, room, text }) {
    const m = tt.beginTurn();
    sp.setValue('party.pc.record.hpCurrent', hp);
    sp.setValue('world.currentRoom', room);
    sp.addValue('session.turnCount', 1);
    sp.setValue('transcript', [...sp.appState.transcript, { role: 'gm', text, turn: 1 }]);
    sp.tick();
    tt.finalizeTurn(m);
  }

  it('undo then redo round-trips a turn exactly, both directions', () => {
    const sp = seed();
    const tt = makeTimeTravel(sp);
    play(sp, tt, { hp: 18, room: 'room-1', text: 'a goblin strikes' });

    assert.equal(sp.appState.world.currentRoom, 'room-1');
    assert.equal(tt.canUndo(), true);
    assert.equal(tt.canRedo(), false);

    assert.equal(tt.undo(), true);
    assert.equal(sp.appState.party.pc.record.hpCurrent, 30);
    assert.equal(sp.appState.world.currentRoom, 'room-0');
    assert.equal(sp.appState.session.turnCount, 0);
    assert.equal(sp.appState.transcript.length, 0);
    assert.equal(tt.canUndo(), false);
    assert.equal(tt.canRedo(), true);

    assert.equal(tt.redo(), true);
    assert.equal(sp.appState.party.pc.record.hpCurrent, 18);
    assert.equal(sp.appState.world.currentRoom, 'room-1');
    assert.equal(sp.appState.session.turnCount, 1);
    assert.equal(tt.canRedo(), false);
  });

  it('walks a multi-turn timeline back and forth', () => {
    const sp = seed();
    const tt = makeTimeTravel(sp);
    play(sp, tt, { hp: 25, room: 'room-1', text: 'one' });
    play(sp, tt, { hp: 20, room: 'room-2', text: 'two' });
    play(sp, tt, { hp: 15, room: 'room-3', text: 'three' });
    assert.equal(sp.appState.session.turnCount, 3);

    assert.equal(tt.undo(), true);  // → after turn 2
    assert.equal(sp.appState.world.currentRoom, 'room-2');
    assert.equal(tt.undo(), true);  // → after turn 1
    assert.equal(sp.appState.world.currentRoom, 'room-1');
    assert.equal(sp.appState.session.turnCount, 1);
    assert.equal(tt.redo(), true);  // → after turn 2
    assert.equal(sp.appState.world.currentRoom, 'room-2');
    assert.equal(sp.appState.session.turnCount, 2);

    // back to the epoch root, then redo cannot pass the head once re-applied
    assert.equal(tt.undo(), true);  // turn 1
    assert.equal(tt.undo(), true);  // root
    assert.equal(tt.canUndo(), false);
    assert.equal(tt.undo(), false); // nothing before the root
    assert.equal(sp.appState.session.turnCount, 0);
    assert.equal(sp.appState.world.currentRoom, 'room-0');
  });

  it('a new turn after undo discards the redo future and forks the dropped tail', () => {
    const sp = seed();
    const tt = makeTimeTravel(sp);
    play(sp, tt, { hp: 18, room: 'room-1', text: 'down the east hall' });
    assert.equal(tt.undo(), true);          // back to root, an undone future exists
    assert.equal(tt.canRedo(), true);

    const forksBefore = sp.forks.length;
    play(sp, tt, { hp: 22, room: 'room-9', text: 'down the WEST hall instead' });

    assert.equal(sp.appState.world.currentRoom, 'room-9'); // on the new branch
    assert.equal(tt.canRedo(), false);                     // old future is gone…
    assert.equal(tt.redo(), false);
    assert.ok(sp.forks.length > forksBefore, 'Spektrum captured the abandoned tail as a fork');

    // the epoch root still survives — we can rewind the divergent turn too
    assert.equal(tt.undo(), true);
    assert.equal(sp.appState.world.currentRoom, 'room-0');
  });

  it('refuses + drops the timeline when the play context changes (no cross-world scrub)', () => {
    const sp = seed();
    const tt = makeTimeTravel(sp);
    play(sp, tt, { hp: 18, room: 'room-1', text: 'deeper in' });
    assert.equal(tt.canUndo(), true);

    sp.setValue('world.location', { type: 'settlement', settlementId: 's1', dungeonId: null });
    sp.tick();

    assert.equal(tt.undo(), false);                         // refused
    assert.equal(tt.redo(), false);
    assert.equal(tt.canUndo(), false);                      // stale timeline dropped
    assert.equal(sp.appState.world.currentRoom, 'room-1');  // state NOT rewound from town
  });
});

// Phase 2 — branch capture + swap. Mirrors the branch machinery in
// src/game/undo.js: an onFork handler captures abandoned tails (epoch-scoped,
// labelled by the action that started the path), and jumpToBranch() replays to
// the divergence point and re-records a branch's entries — which forks (and so
// re-captures) the path being left.
// Shared divergence helpers (mirror undo.js): the turn index where two entry
// lists first differ — jumpToBranch lands there so the branch's later turns stay
// ahead as future.
const entriesEqual = (x, y) => x && y && x.op === y.op && x.path === y.path && JSON.stringify(x.value) === JSON.stringify(y.value);
function commonTurnPrefix(a, b) {
  let i = 0;
  const n = Math.min(a.length, b.length);
  while (i < n && entriesEqual(a[i], b[i])) i++;
  let t = 0;
  for (let j = 0; j < i; j++) if (a[j].op === 'checkpoint' && a[j].id === 'turn') t++;
  return t;
}

function makeBranching(sp) {
  let stops = [], pos = 0, epochSig = null;
  let branches = [], seq = 0;
  const sig = () => {
    const loc = sp.appState.world?.location ?? {};
    return `${loc.type ?? ''}|${loc.dungeonId ?? ''}|${loc.settlementId ?? ''}`;
  };
  const labelFork = (fork) => {
    for (const e of fork.entries) {
      if (e.path === 'transcript' && Array.isArray(e.value)) {
        const p = [...e.value].reverse().find(x => x?.role === 'player');
        if (p?.text) return p.text;
      }
    }
    return 'an earlier path';
  };
  sp.onFork((fork) => {
    if (!stops.length || fork.forkedAt < stops[0]) return;
    // Root-relative: store the full branch from the epoch root (shared prefix +
    // dropped tail), so a swap replays to the always-stable root.
    const entries = sp.history.slice(stops[0], fork.forkedAt).concat(fork.entries);
    const turns = entries.filter(e => e.op === 'checkpoint' && e.id === 'turn').length;
    branches.push({ id: `b${seq++}`, label: labelFork(fork), turns, entries });
  });
  const reapply = (entries) => {
    for (const e of entries) {
      if (e.op === 'checkpoint') sp.checkpoint(e.id, e.value);
      else if (e.op === 'add')   sp.addValue(e.path, e.value, e.id);
      else                       sp.setValue(e.path, e.value, e.id);
    }
  };
  const rebuildStops = () => {
    const root = stops[0] ?? 0;
    const out = [root];
    sp.history.forEach((e, i) => { if (e.op === 'checkpoint' && e.id === 'turn' && i >= root) out.push(i + 1); });
    stops = out; pos = stops.length - 1;
  };
  return {
    get branches() { return branches.map(b => ({ id: b.id, label: b.label, turns: b.turns })); },
    get pos() { return pos; },
    get stopCount() { return stops.length; },
    undoTo: (k) => { if (k < 0 || k >= stops.length) return false; pos = k; sp.replay(stops[pos]); return true; },
    beginTurn: () => sp.appState.world?.location?.type === 'encounter'
      ? null : { index: sp.history.length, sig: sig() },
    finalizeTurn: (m) => {
      if (!m) return;
      if (!stops.length || epochSig !== m.sig) { epochSig = m.sig; stops = [m.index]; pos = 0; }
      else if (pos < stops.length - 1) { stops.length = pos + 1; }
      sp.checkpoint('turn');
      stops.push(sp.history.length);
      pos = stops.length - 1;
    },
    undo: () => { if (pos <= 0) return false; pos -= 1; sp.replay(stops[pos]); return true; },
    redo: () => { if (pos >= stops.length - 1) return false; pos += 1; sp.replay(stops[pos]); return true; },
    jumpToBranch: (id) => {
      const idx = branches.findIndex(b => b.id === id);
      if (idx < 0) return false;
      const prev = sp.history.slice(stops[0], stops[stops.length - 1]);
      const b = branches.splice(idx, 1)[0];
      sp.replay(stops[0]);          // replay to the ROOT, then re-apply the full branch
      reapply(b.entries);
      sp.tick();
      rebuildStops();
      pos = Math.min(commonTurnPrefix(b.entries, prev), stops.length - 1);   // land at the divergence
      sp.replay(stops[pos]);
      return true;
    },
  };
}

describe('time-travel branching (mirrors src/game/undo.js Phase 2)', () => {
  function seed() {
    const sp = createSpektrum();
    sp.setValue('world.location', { type: 'dungeon', dungeonId: 'd1' });
    sp.setValue('world.currentRoom', 'room-0');
    sp.setValue('session.turnCount', 0);
    sp.setValue('transcript', []);
    sp.tick();
    return sp;
  }
  function play(sp, tt, { room, text }) {
    const m = tt.beginTurn();
    sp.setValue('world.currentRoom', room);
    sp.addValue('session.turnCount', 1);
    sp.setValue('transcript', [
      ...sp.appState.transcript,
      { role: 'player', text, turn: 0 },
      { role: 'gm',     text: `narration for "${text}"`, turn: 0 },
    ]);
    sp.tick();
    tt.finalizeTurn(m);
  }

  it('captures the abandoned path as a labelled branch on divergence', () => {
    const sp = seed();
    const tt = makeBranching(sp);
    play(sp, tt, { room: 'room-east', text: 'go east' });
    assert.equal(tt.undo(), true);                          // back to the root
    assert.equal(tt.branches.length, 0);
    play(sp, tt, { room: 'room-west', text: 'go west' });   // diverge onto a new path
    assert.equal(sp.appState.world.currentRoom, 'room-west');
    assert.equal(tt.branches.length, 1);
    assert.equal(tt.branches[0].label, 'go east');          // the path not taken, labelled
  });

  it('jumps onto a branch at the divergence point, with its future ahead, re-capturing the path left', () => {
    const sp = seed();
    const tt = makeBranching(sp);
    play(sp, tt, { room: 'room-east', text: 'go east' });
    tt.undo();
    play(sp, tt, { room: 'room-west', text: 'go west' });
    const east = tt.branches.find(b => b.label === 'go east');
    assert.ok(east, 'east path captured');

    assert.equal(tt.jumpToBranch(east.id), true);
    assert.equal(sp.appState.world.currentRoom, 'room-0');    // at the fork (east/west diverge at the root)
    assert.equal(tt.redo(), true);                            // its future is available…
    assert.equal(sp.appState.world.currentRoom, 'room-east'); // …and leads onto the east path
    assert.equal(tt.branches.length, 1);
    assert.equal(tt.branches[0].label, 'go west');            // the west path is now the alternative
  });

  it('ping-pongs between two branches without losing either', () => {
    const sp = seed();
    const tt = makeBranching(sp);
    play(sp, tt, { room: 'room-east', text: 'go east' });
    tt.undo();
    play(sp, tt, { room: 'room-west', text: 'go west' });

    const east = tt.branches.find(b => b.label === 'go east').id;
    assert.equal(tt.jumpToBranch(east), true);
    assert.equal(sp.appState.world.currentRoom, 'room-0');   // fork; redo into the chosen future
    tt.redo();
    assert.equal(sp.appState.world.currentRoom, 'room-east');

    const west = tt.branches.find(b => b.label === 'go west').id;
    assert.equal(tt.jumpToBranch(west), true);
    assert.equal(sp.appState.world.currentRoom, 'room-0');
    tt.redo();
    assert.equal(sp.appState.world.currentRoom, 'room-west');
    assert.equal(tt.branches.length, 1);                     // always exactly one alternative
    assert.equal(tt.branches[0].label, 'go east');
  });

  it('restores the branch transcript as you move forward into it', () => {
    const sp = seed();
    const tt = makeBranching(sp);
    play(sp, tt, { room: 'room-east', text: 'go east' });
    tt.undo();
    play(sp, tt, { room: 'room-west', text: 'go west' });
    assert.ok(sp.appState.transcript.some(e => e.text === 'go west'));

    const east = tt.branches.find(b => b.label === 'go east').id;
    tt.jumpToBranch(east);                                                // lands at the root fork
    assert.ok(!sp.appState.transcript.some(e => e.text === 'go west'));   // west path gone from the live transcript
    assert.ok(!sp.appState.transcript.some(e => e.text === 'go east'));   // east not reached yet — it's the future
    tt.redo();
    assert.ok(sp.appState.transcript.some(e => e.text === 'go east'));    // east narration appears as you go forward
  });

  it('jumps to a DEEP branch correctly after a shallower divergence truncated history (root-relative)', () => {
    // This is the multi-level case the Phase 3 hardening fixes: a forkedAt-indexed
    // branch would be left pointing into history a later, shallower swap replaced.
    const sp = seed();
    const tt = makeBranching(sp);
    play(sp, tt, { room: 'room-1', text: 'turn one' });
    play(sp, tt, { room: 'room-2', text: 'turn two' });
    play(sp, tt, { room: 'room-3', text: 'turn three' });   // path A, deep

    tt.undo();                                               // back to after turn 2
    play(sp, tt, { room: 'room-3b', text: 'turn three prime' }); // diverge → branch A (full 1,2,3) captured
    tt.undo(); tt.undo();                                    // back to after turn 1 (shallower than A's fork)
    play(sp, tt, { room: 'room-2c', text: 'turn two double' });  // diverge → truncates the turn-2 region

    // Branch A diverged at the DEEP point (after turn 2); the second divergence
    // truncated/replaced that region. Root-relative entries make it recoverable.
    const deep = tt.branches.find(b => b.label === 'turn three');
    assert.ok(deep, 'deep branch A survived');
    assert.equal(deep.turns, 3);
    assert.equal(tt.jumpToBranch(deep.id), true);
    assert.equal(sp.appState.world.currentRoom, 'room-1');   // fork (shares turn 1 with the current path)
    tt.redo();
    assert.equal(sp.appState.world.currentRoom, 'room-2');
    tt.redo();
    assert.equal(sp.appState.world.currentRoom, 'room-3');   // A's deep future reconstructed exactly, not corrupted
    assert.ok(sp.appState.transcript.some(e => e.text === 'turn three'));
  });

  it('switching to a branch leaves both its past AND future navigable (the reported fix)', () => {
    const sp = seed();
    const tt = makeBranching(sp);
    play(sp, tt, { room: 'room-1', text: 'one' });
    play(sp, tt, { room: 'room-2', text: 'two' });
    play(sp, tt, { room: 'room-3', text: 'three' });        // branch A: 1,2,3
    tt.undo(); tt.undo();                                    // back to turn 1
    play(sp, tt, { room: 'room-2b', text: 'two prime' });    // diverge → A captured, now on B at its head

    const A = tt.branches[0];
    assert.ok(A, 'branch A captured');
    assert.equal(tt.jumpToBranch(A.id), true);

    // FUTURE available — redo forward through A's turns to its head
    assert.equal(tt.redo(), true); assert.equal(sp.appState.world.currentRoom, 'room-2');
    assert.equal(tt.redo(), true); assert.equal(sp.appState.world.currentRoom, 'room-3');
    assert.equal(tt.redo(), false);                          // at A's head — nothing beyond

    // PAST available — undo back through A
    assert.equal(tt.undo(), true); assert.equal(sp.appState.world.currentRoom, 'room-2');
    assert.equal(tt.undo(), true); assert.equal(sp.appState.world.currentRoom, 'room-1');

    assert.equal(tt.branches.length, 1);                     // the path we left stays a switchable alternative
  });

  it('scrubs directly to any turn on the spine and back', () => {
    const sp = seed();
    const tt = makeBranching(sp);
    play(sp, tt, { room: 'room-1', text: 'one' });
    play(sp, tt, { room: 'room-2', text: 'two' });
    play(sp, tt, { room: 'room-3', text: 'three' });
    assert.equal(tt.stopCount, 4);   // root + 3 turns

    assert.equal(tt.undoTo(1), true);                       // jump straight to after turn 1
    assert.equal(sp.appState.world.currentRoom, 'room-1');
    assert.equal(tt.undoTo(3), true);                       // jump straight to the head
    assert.equal(sp.appState.world.currentRoom, 'room-3');
    assert.equal(tt.undoTo(0), true);                       // jump to the root
    assert.equal(sp.appState.world.currentRoom, 'room-0');
  });
});

// Phase 4 — persistence across reload. Mirrors src/game/undo.js's root-baseline
// export/import: capture the epoch root state on the first turn, persist the
// spine + branches, and rebuild them into a FRESH store (the reload). The real
// module wraps import in a failsafe and caps oversized epochs; the round-trip
// mechanism is what's pinned here.
function makePersistable(sp) {
  const PERSIST = ['world', 'session', 'transcript'];
  let stops = [], pos = 0, epochSig = null, root = null;
  let branches = [], seq = 0;
  const snapshotPersisted = () => Object.fromEntries(PERSIST.map(k => [k, sp.appState[k]]));
  const restore = (snap) => { for (const k of PERSIST) sp.setValue(k, snap[k]); };
  const labelFork = (fork) => {
    for (const e of fork.entries) {
      if (e.path === 'transcript' && Array.isArray(e.value)) {
        const p = [...e.value].reverse().find(x => x?.role === 'player');
        if (p?.text) return p.text;
      }
    }
    return '?';
  };
  const reapply = (entries) => {
    for (const e of entries) {
      if (e.op === 'checkpoint') sp.checkpoint(e.id, e.value);
      else if (e.op === 'add')   sp.addValue(e.path, e.value, e.id);
      else                       sp.setValue(e.path, e.value, e.id);
    }
  };
  const rebuildFrom = (rootIdx) => {
    stops = [rootIdx];
    sp.history.forEach((e, i) => { if (e.op === 'checkpoint' && e.id === 'turn' && i >= rootIdx) stops.push(i + 1); });
    pos = stops.length - 1;
  };
  sp.onFork((fork) => {
    if (!stops.length || fork.forkedAt < stops[0]) return;
    const entries = sp.history.slice(stops[0], fork.forkedAt).concat(fork.entries);
    branches.push({ id: `b${seq++}`, label: labelFork(fork), turns: entries.filter(e => e.op === 'checkpoint' && e.id === 'turn').length, entries });
  });
  return {
    get pos() { return pos; },
    get branches() { return branches.map(b => ({ id: b.id, label: b.label, turns: b.turns })); },
    beginTurn: () => { if (!stops.length) root = JSON.parse(JSON.stringify(snapshotPersisted())); return { index: sp.history.length, sig: '' }; },
    finalizeTurn: (m) => {
      if (!stops.length || epochSig !== m.sig) { epochSig = m.sig; stops = [m.index]; pos = 0; }
      else if (pos < stops.length - 1) stops.length = pos + 1;
      sp.checkpoint('turn');
      stops.push(sp.history.length);
      pos = stops.length - 1;
    },
    undo: () => { if (pos <= 0) return false; pos -= 1; sp.replay(stops[pos]); return true; },
    redo: () => { if (pos >= stops.length - 1) return false; pos += 1; sp.replay(stops[pos]); return true; },
    jumpToBranch: (id) => {
      const i = branches.findIndex(b => b.id === id);
      if (i < 0) return false;
      const prev = sp.history.slice(stops[0], stops[stops.length - 1]);
      const b = branches.splice(i, 1)[0];
      sp.replay(stops[0]); reapply(b.entries); sp.tick(); rebuildFrom(stops[0]);
      pos = Math.min(commonTurnPrefix(b.entries, prev), stops.length - 1);   // land at the divergence
      sp.replay(stops[pos]);
      return true;
    },
    exportTT: () => {
      if (stops.length < 2 || !root) return null;
      const head = stops[stops.length - 1];
      return { pos, root, spine: sp.history.slice(stops[0], head), branches: branches.map(b => ({ label: b.label, turns: b.turns, entries: b.entries })) };
    },
    importTT: (tt, expected) => {
      restore(tt.root); sp.tick();
      const r = sp.history.length;
      reapply(tt.spine); sp.tick();
      rebuildFrom(r);
      branches = tt.branches.map(b => ({ id: `b${seq++}`, label: b.label, turns: b.turns, entries: b.entries }));
      pos = Math.min(tt.pos, stops.length - 1);
      sp.replay(stops[pos]);
      // Consistency guard (mirrors matchesSaved in undo.js): the reconstructed
      // live state must match the saved snapshot, else discard the rebuild.
      if (expected && (
        sp.appState.world?.currentRoom        !== expected.world?.currentRoom ||
        (sp.appState.session?.turnCount ?? 0) !== (expected.session?.turnCount ?? 0) ||
        (sp.appState.transcript?.length ?? 0) !== (expected.transcript?.length ?? 0))) {
        stops = []; pos = 0; branches = [];
        return false;
      }
      return true;
    },
  };
}

describe('time-travel persistence (mirrors src/game/undo.js Phase 4)', () => {
  function seedWorld() {
    const sp = createSpektrum();
    sp.setValue('world', { location: { type: 'dungeon', dungeonId: 'd1' }, currentRoom: 'room-0' });
    sp.setValue('session', { turnCount: 0 });
    sp.setValue('transcript', []);
    sp.tick();
    return sp;
  }
  function play(sp, tt, { room, text }) {
    const m = tt.beginTurn();
    sp.setValue('world.currentRoom', room);
    sp.addValue('session.turnCount', 1);
    sp.setValue('transcript', [...sp.appState.transcript, { role: 'player', text, turn: 0 }, { role: 'gm', text: `re: ${text}`, turn: 0 }]);
    sp.tick();
    tt.finalizeTurn(m);
  }

  it('exports an epoch and re-imports it into a FRESH store: position, undo/redo, and branches survive', () => {
    const sp1 = seedWorld();
    const tt1 = makePersistable(sp1);
    play(sp1, tt1, { room: 'room-1', text: 'go north' });
    play(sp1, tt1, { room: 'room-2', text: 'fight goblin' });
    tt1.undo();                                          // back to after turn 1
    play(sp1, tt1, { room: 'room-2b', text: 'flee' });   // diverge → branch 'fight goblin'
    tt1.undo();                                          // scrub back to after turn 1 (pos = 1)

    const blob = tt1.exportTT();
    assert.ok(blob, 'epoch is exportable');

    // Simulate the reload: a brand-new store, nothing carried over but the blob.
    const sp2 = seedWorld();         // a fresh store (its own setup history)
    const tt2 = makePersistable(sp2);
    assert.equal(tt2.importTT(blob), true);

    assert.equal(sp2.appState.world.currentRoom, 'room-1');  // restored to the saved position…
    assert.equal(tt2.pos, 1);

    assert.equal(tt2.redo(), true);                          // …and undo/redo work in the fresh store
    assert.equal(sp2.appState.world.currentRoom, 'room-2b');
    assert.equal(tt2.undo(), true);
    assert.equal(sp2.appState.world.currentRoom, 'room-1');

    const fight = tt2.branches.find(b => b.label === 'fight goblin');
    assert.ok(fight, 'the abandoned branch survived the round-trip');
    assert.equal(fight.turns, 2);
    assert.equal(tt2.jumpToBranch(fight.id), true);
    assert.equal(sp2.appState.world.currentRoom, 'room-1');  // fork (shares turn 1); its future is ahead
    tt2.redo();
    assert.equal(sp2.appState.world.currentRoom, 'room-2');  // swappable after reload, with future reachable
  });

  it('exports null for a trivial epoch (no committed turns → nothing to persist)', () => {
    const sp = seedWorld();
    const tt = makePersistable(sp);
    assert.equal(tt.exportTT(), null);
    play(sp, tt, { room: 'room-1', text: 'one step' });
    assert.ok(tt.exportTT(), 'one committed turn is persistable');
  });

  it('accepts a faithful reconstruction but rejects one that diverges from the saved state (T1.5)', () => {
    const sp1 = seedWorld();
    const tt1 = makePersistable(sp1);
    play(sp1, tt1, { room: 'room-1', text: 'go north' });
    play(sp1, tt1, { room: 'room-2', text: 'onward' });
    const blob  = tt1.exportTT();
    const saved = { world: { currentRoom: 'room-2' }, session: { turnCount: 2 }, transcript: sp1.appState.transcript };

    const spA = seedWorld(), ttA = makePersistable(spA);
    assert.equal(ttA.importTT(blob, saved), true);                 // faithful → accepted
    assert.equal(spA.appState.world.currentRoom, 'room-2');

    const spB = seedWorld(), ttB = makePersistable(spB);
    const wrong = { ...saved, world: { currentRoom: 'room-WRONG' } };
    assert.equal(ttB.importTT(blob, wrong), false);                // diverged → rejected (caller falls back)
    assert.equal(ttB.branches.length, 0);                          // history discarded on rejection
  });

  it('captures a story flag recorded BEFORE the boundary, but not one recorded after (trailing-flag fix)', () => {
    // loop.js now records the turn's flag writes BEFORE finalizeTurn, so they fall
    // inside the boundary and survive a reload. A write after finalizeTurn would
    // land outside the spine — the bug this ordering avoids.
    const playWithFlag = (afterBoundary) => {
      const sp = seedWorld(), tt = makePersistable(sp);
      const m = tt.beginTurn();
      sp.setValue('world.currentRoom', 'room-1');
      sp.addValue('session.turnCount', 1);
      sp.setValue('transcript', [...sp.appState.transcript, { role: 'player', text: 'slay the boss', turn: 0 }, { role: 'gm', text: 'the boss falls', turn: 0 }]);
      if (!afterBoundary) { sp.setValue('world.redThread', { flags: { bossSlain: true } }); }
      sp.tick();
      tt.finalizeTurn(m);
      if (afterBoundary) { sp.setValue('world.redThread', { flags: { bossSlain: true } }); sp.tick(); }
      // round-trip into a fresh store
      const fresh = seedWorld(), ttF = makePersistable(fresh);
      ttF.importTT(tt.exportTT());
      return fresh.appState.world.redThread?.flags?.bossSlain;
    };

    assert.equal(playWithFlag(false), true);          // flag before the boundary → survives the reload
    assert.notEqual(playWithFlag(true), true);        // flag after the boundary → lost (the avoided bug)
  });
});

// T1.1 — narrowing commitAll/commitDownTurn from whole-`world`/`party` writes to
// sub-paths. Two guarantees the resolver now relies on, pinned against the
// vendored engine: (1) a reactive subscriber on an ancestor path (e.g.
// 'world.npcs') still fires when a descendant path is written, so the ui.*
// computed bindings refresh; (2) narrow writes replay/undo exactly.
describe('narrow sub-path commits (T1.1)', () => {
  it('a descendant write (world.npcs.<id>) re-fires watch + computed subscribed to the ancestor', () => {
    const sp = createSpektrum();
    sp.setValue('world', { currentRoom: 'room-0', npcs: { 'enemy-1': { hp: 7, alive: true, attitude: 'hostile' } } });
    sp.tick();
    let watchFires = 0, computedRuns = 0;
    sp.watch(['world.npcs', 'world.currentRoom'], () => { watchFires++; });
    sp.computed('ui.enemyStats', ['world.npcs', 'world.currentRoom'], () => { computedRuns++; return 'x'; });
    sp.tick();
    const w = watchFires, c = computedRuns;

    sp.setValue('world.npcs.enemy-1', { hp: 0, alive: false, attitude: 'dead' });   // narrow, descendant
    sp.tick();
    assert.ok(watchFires  > w, 'watch fired on the descendant write');
    assert.ok(computedRuns > c, 'computed re-ran on the descendant write');

    const w2 = watchFires;
    sp.setValue('world.currentRoom', 'room-1');   // sibling dep also still fires
    sp.tick();
    assert.ok(watchFires > w2, 'watch fired on the currentRoom write');
  });

  it('a narrow npc write preserves siblings and round-trips through undo', () => {
    const sp = createSpektrum();
    sp.setValue('world', { currentRoom: 'room-0', npcs: {
      boss:      { hp: 12, alive: true, attitude: 'hostile' },
      'enemy-1': { hp: 5,  alive: true, attitude: 'hostile' },
    } });
    sp.tick();
    const mark = sp.history.length;   // pre-turn boundary

    // the kill turn, exactly as narrowed commitAll records it:
    const npc = sp.appState.world.npcs.boss;
    sp.setValue('world.npcs.boss', { ...npc, hp: 0, alive: false, attitude: 'dead' });
    sp.tick();
    assert.equal(sp.appState.world.npcs.boss.alive, false);
    assert.equal(sp.appState.world.npcs['enemy-1'].hp, 5);   // sibling untouched by the narrow write

    sp.replay(mark);   // undo
    assert.equal(sp.appState.world.npcs.boss.alive, true);   // alive restored…
    assert.equal(sp.appState.world.npcs.boss.hp, 12);        // …and hp
    assert.equal(sp.appState.world.npcs['enemy-1'].hp, 5);
  });

  it('a narrow party.pc.record write preserves the sibling sheet and replaces arrays', () => {
    const sp = createSpektrum();
    sp.setValue('party', { pc: { record: { hpCurrent: 10, conditions: ['unconscious'] }, sheet: { hp: { max: 10 } } }, inventory: [] });
    sp.tick();
    const prev = sp.appState.party.pc.record;
    sp.setValue('party.pc.record', { ...prev, hpCurrent: 1, conditions: [] });   // revive: clear conditions
    sp.tick();
    assert.equal(sp.appState.party.pc.record.hpCurrent, 1);
    assert.deepEqual(sp.appState.party.pc.record.conditions, []);   // array replaced, not merged
    assert.equal(sp.appState.party.pc.sheet.hp.max, 10);            // sibling sheet preserved
  });
});

// T2.1 — the app's Spektrum instance is created with `snapshotEvery` so replay()
// (undo/redo/branch-jump) is O(K) not O(n). Snapshots are a transparent
// accelerator: replay must still reconstruct the exact state at any index. Pin
// that against the vendored engine so the config can't silently corrupt scrubs.
describe('replay correctness with snapshotEvery (T2.1)', () => {
  it('reconstructs the exact state at any boundary, with snapshots enabled', () => {
    const sp = createSpektrum({ snapshotEvery: 3 });
    sp.setValue('world.currentRoom', 'room-0');
    sp.setValue('session.turnCount', 0);
    sp.tick();
    const marks = [];
    for (let t = 1; t <= 12; t++) {
      marks.push(sp.history.length);
      sp.setValue('world.currentRoom', 'room-' + t);
      sp.addValue('session.turnCount', 1);
      sp.tick();
    }
    assert.ok(sp.snapshots.length > 0, 'snapshots were captured');

    sp.replay(marks[5]);                         // before turn 6
    assert.equal(sp.appState.world.currentRoom, 'room-5');
    assert.equal(sp.appState.session.turnCount, 5);

    sp.replay(marks[0]);                         // before turn 1
    assert.equal(sp.appState.world.currentRoom, 'room-0');
    assert.equal(sp.appState.session.turnCount, 0);

    sp.replay(sp.history.length);                // head
    assert.equal(sp.appState.world.currentRoom, 'room-12');
    assert.equal(sp.appState.session.turnCount, 12);
  });
});

// T2.3 — the in-session branch registry is capped (oldest evicted), bounding
// memory and the persisted blob. Mirrors captureFork's eviction.
describe('branch registry cap (T2.3)', () => {
  it('keeps only the most recent MAX branches', () => {
    const MAX = 3;
    const branches = [];
    const push = (label) => {
      branches.push({ label });
      if (branches.length > MAX) branches.splice(0, branches.length - MAX);
    };
    for (let i = 1; i <= 6; i++) push('b' + i);
    assert.equal(branches.length, MAX);
    assert.deepEqual(branches.map(b => b.label), ['b4', 'b5', 'b6']);   // oldest three evicted
  });
});

// T2.2 — exportTimeTravel is memoized; it rebuilds the blob only when the
// timeline changed (notify() sets the dirty flag). Mirrors the memo in undo.js.
describe('exportTimeTravel memo (T2.2)', () => {
  it('reuses the cached blob until a timeline change invalidates it', () => {
    let dirty = true, cache = null, builds = 0;
    const build    = () => { builds++; return { v: builds }; };
    const exportTT = () => { if (!dirty) return cache; dirty = false; cache = build(); return cache; };
    const notify   = () => { dirty = true; };

    const a = exportTT();          // first call builds
    const b = exportTT();          // cached — no rebuild
    assert.equal(a, b);
    assert.equal(builds, 1);

    notify();                      // timeline changed
    const c = exportTT();          // rebuilds
    assert.notEqual(c, a);
    assert.equal(builds, 2);
  });
});

// story.js tidy-up — narrowing setStoryFlag/completeBeatNow/awardReputation from
// whole-`world` writes to world.redThread / world.factionReputation. The subtle
// requirement: deep-merge must accumulate flags across writes (not replace the
// flags object), preserve sibling world keys, and round-trip through undo.
describe('narrow story writes deep-merge additively (story.js tidy-up)', () => {
  it('a world.redThread write adds a flag without losing prior flags or sibling world keys', () => {
    const sp = createSpektrum();
    sp.setValue('world', {
      currentRoom: 'room-0',
      npcs: { boss: { hp: 10, alive: true } },
      redThread: { beats: [{ id: 'b1' }], currentIndex: 0, flags: { 'enemy-slain': true } },
    });
    sp.tick();

    const rt = sp.appState.world.redThread;                                   // setStoryFlag-style write
    sp.setValue('world.redThread', { ...rt, flags: { ...rt.flags, 'boss-slain': true } });
    sp.tick();

    assert.equal(sp.appState.world.redThread.flags['enemy-slain'], true);     // prior flag kept
    assert.equal(sp.appState.world.redThread.flags['boss-slain'], true);      // new flag added
    assert.equal(sp.appState.world.redThread.currentIndex, 0);
    assert.deepEqual(sp.appState.world.redThread.beats, [{ id: 'b1' }]);
    assert.equal(sp.appState.world.npcs.boss.hp, 10);                         // sibling world key untouched
  });

  it('advancing the beat via a redThread write round-trips through undo', () => {
    const sp = createSpektrum();
    sp.setValue('world', { redThread: { beats: [], currentIndex: 2, flags: {} } });
    sp.tick();
    const mark = sp.history.length;

    const rt = sp.appState.world.redThread;                                   // completeBeatNow-style write
    sp.setValue('world.redThread', { ...rt, currentIndex: 3, flags: { 'beat-done-2': true } });
    sp.tick();
    assert.equal(sp.appState.world.redThread.currentIndex, 3);

    sp.replay(mark);                                                          // undo the story turn
    assert.equal(sp.appState.world.redThread.currentIndex, 2);
    assert.deepEqual(sp.appState.world.redThread.flags, {});                  // flag reverted
  });
});
