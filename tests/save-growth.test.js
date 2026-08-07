// Recorded-state growth — the silent-data-loss defect.
//
// appendTranscript used to write the WHOLE transcript array on every turn, and
// commitRoller the whole roll log. Spektrum records each write as a history
// entry, and the persisted time-travel spine stores those entries verbatim, so
// save bytes grew with turns × epoch-turns: ~13 MB of history by turn 200
// against a ~5 MB localStorage quota. The write then failed silently, play
// carried on unsaved, and the run was lost on reload.
//
// These tests pin the SHAPE that fixes it: one recorded entry per appended item,
// so history grows linearly. They mirror the append pattern rather than importing
// resolver.js/rng.js, which bind the Spektrum singleton at import time (the
// repo's mirror-testing convention — see seeded-rolls.test.js).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSpektrum } from '../vendor/spektrum.js';

const NARRATION = 'x'.repeat(600);   // a typical GM paragraph

function play(turns, { narrow }) {
  const s = createSpektrum({ snapshotEvery: 25 });
  s.setValue('transcript', []);
  s.tick();
  for (let turn = 0; turn < turns; turn++) {
    if (narrow) {
      const i = s.appState.transcript.length;
      s.setValue(`transcript.${i}`,     { role: 'player', text: 'go north', turn });
      s.setValue(`transcript.${i + 1}`, { role: 'gm',     text: NARRATION, turn });
    } else {
      s.setValue('transcript', [...s.appState.transcript,
        { role: 'player', text: 'go north', turn },
        { role: 'gm',     text: NARRATION, turn }]);
    }
    s.tick();
  }
  return { state: s.appState, historyBytes: JSON.stringify(s.history).length };
}

describe('transcript appends are narrow', () => {
  it('produces the same transcript as a whole-array rewrite', () => {
    assert.deepEqual(play(5, { narrow: true }).state.transcript,
                     play(5, { narrow: false }).state.transcript);
  });

  it('keeps the transcript a real array', () => {
    const { state } = play(4, { narrow: true });
    assert.ok(Array.isArray(state.transcript));
    assert.equal(state.transcript.length, 8);
  });

  it('grows history linearly, not quadratically', () => {
    const at50  = play(50,  { narrow: true }).historyBytes;
    const at200 = play(200, { narrow: true }).historyBytes;
    const ratio = at200 / at50;   // 4x the turns should cost ~4x the bytes
    assert.ok(ratio < 6, `history grew ${ratio.toFixed(1)}x for 4x the turns — expected ~4x (quadratic regression?)`);
  });

  it('stays far under the localStorage quota at 200 turns', () => {
    const { historyBytes } = play(200, { narrow: true });
    const mb = historyBytes / 1024 / 1024;
    assert.ok(mb < 1, `200 turns of history is ${mb.toFixed(2)} MB — the ~5 MB quota is shared with world, saves and caches`);
  });

  it('is dramatically smaller than the whole-array write it replaced', () => {
    const narrow = play(200, { narrow: true }).historyBytes;
    const whole  = play(200, { narrow: false }).historyBytes;
    assert.ok(whole / narrow > 10,
      `expected a large saving at 200 turns, got ${(whole / narrow).toFixed(1)}x`);
  });
});

describe('roll log appends are narrow', () => {
  it('appends entries one index at a time', () => {
    const s = createSpektrum({ snapshotEvery: 25 });
    s.setValue('session', { rollLog: [] });
    s.tick();
    for (let turn = 0; turn < 20; turn++) {
      let i = s.appState.session.rollLog.length;
      for (const entry of [{ op: 'rollDie', d: 20 }, { op: 'rollDie', d: 6 }]) {
        s.setValue(`session.rollLog.${i++}`, entry);
      }
      s.tick();
    }
    assert.equal(s.appState.session.rollLog.length, 40);
    assert.ok(Array.isArray(s.appState.session.rollLog));
    // Every recorded entry should be one roll, never a copy of the whole log.
    const bytes = JSON.stringify(s.history).length;
    assert.ok(bytes < 20_000, `roll-log history is ${bytes} bytes — expected a small linear log`);
  });
});
