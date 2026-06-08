import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// T1.4 — the real-spend accumulator is intentionally OUTSIDE Spektrum history
// (module var + localStorage), so undo can't rewind it. localStorage is absent
// in node; spend.js swallows that and starts at zero, so this exercises the pure
// accumulation + listener contract.
import { addSpend, getSpend, onSpendChange } from '../src/ai/spend.js';

describe('real-spend accumulator (T1.4)', () => {
  it('accumulates monotonically and notifies listeners; ignores no-op adds', () => {
    const seen = [];
    onSpendChange(s => seen.push({ ...s }));
    const before = { ...getSpend() };

    addSpend(100, 0.01);
    addSpend(50, 0.005);

    const after = getSpend();
    assert.equal(after.tokens, before.tokens + 150);
    assert.ok(Math.abs(after.costUsd - (before.costUsd + 0.015)) < 1e-9);
    assert.ok(seen.length >= 2, 'listener fired once per real add');

    const n = seen.length;
    addSpend(0, 0);                       // no-op: no change, no notification
    assert.equal(getSpend().tokens, after.tokens);
    assert.equal(seen.length, n);
  });
});
