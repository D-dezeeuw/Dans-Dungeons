// The cold-archive integration seam, proven end to end.
//
// The verification audit's worst storage finding: saveToStorage() re-archived
// the ENTIRE overflow every turn (no watermark, live array never trimmed) —
// 88x duplication at 200 turns, ~2.3 GB extrapolated at the 80-hour mark, and
// fullTranscript() fed the duplicates to the journal and world bible. Both
// suites were green because the client tests only appended disjoint batches
// and no game test touched the cold tier at all.
//
// This file drives the REAL vendored persistence functions through the exact
// algorithm src/core/state.js now implements (watermark in session.archived,
// advance-on-confirmed-write with compare-and-set, dedupe on read). state.js
// itself is Spektrum-bound and cannot load under node; if its algorithm
// drifts from this file, that drift is the bug.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  openCold, appendSegment, readSegments, splitSave,
} from '../vendor/bag-of-holding-client/src/persistence/idb.js';

// Minimal in-memory IndexedDB — same surface the client's own tests fake.
function fakeIndexedDB({ failPuts = () => false } = {}) {
  const stores = new Map();
  const store = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name);
  };
  const ok = (result) => { const req = { result }; queueMicrotask(() => req.onsuccess?.()); return req; };
  const fail = () => { const req = {}; queueMicrotask(() => req.onerror?.()); return req; };
  return {
    open() {
      const db = {
        objectStoreNames: { contains: (n) => stores.has(n) },
        createObjectStore: (n) => store(n),
        transaction: (name) => ({
          objectStore: () => ({
            put: (row) => { if (failPuts()) return fail(); store(name).set(row.key, row.value); return ok(undefined); },
            get: (key) => ok(store(name).has(key) ? { key, value: store(name).get(key) } : undefined),
            getAllKeys: () => ok([...store(name).keys()]),
            getAll: () => ok([...store(name).entries()].map(([key, value]) => ({ key, value }))),
            delete: (key) => { store(name).delete(key); return ok(undefined); },
          }),
        }),
      };
      const req = { result: db };
      queueMicrotask(() => { req.onupgradeneeded?.(); req.onsuccess?.(); });
      return req;
    },
  };
}

// state.js's dedupe contract: keep-first by (turn, role, text).
function dedupeHistory(entries) {
  const seen = new Set();
  const out = [];
  for (const e of entries) {
    const key = `${e?.turn ?? ''}|${e?.role ?? ''}|${e?.text ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

const HOT = { keepTranscript: 50, keepLedger: 200 };
const entry = (turn, role) => ({ role, text: `${role}${turn}`, turn });

// One simulated campaign turn through state.js's algorithm.
async function saveCycle(db, transcript, marks) {
  const snapshot = { transcript, world: { ledger: [] } };
  const { hot, cold } = splitSave(snapshot, {
    ...HOT, archivedTranscript: marks.transcript, archivedLedger: marks.ledger,
  });
  let tOk = true;
  if (cold.transcript.length) {
    tOk = !!(await appendSegment(db, 'transcript', 'run', cold.transcript));
  }
  if (tOk) marks.transcript = hot.archived.transcript;   // advance on success only
  return { hot, cold };
}

describe('the cold archive at campaign scale', () => {
  it('200 turns archive every entry exactly once — the 88x duplication is gone', async () => {
    const db = await openCold(fakeIndexedDB());
    const transcript = [];
    const marks = { transcript: 0, ledger: 0 };
    for (let t = 1; t <= 200; t++) {
      transcript.push(entry(t, 'player'), entry(t, 'gm'));
      await saveCycle(db, transcript, marks);
    }
    const archived = await readSegments(db, 'transcript', 'run');
    const full = dedupeHistory([...archived, ...transcript.slice(-HOT.keepTranscript)]);
    assert.equal(archived.length, 400 - HOT.keepTranscript, 'archive holds each overflow entry ONCE');
    assert.equal(new Set(archived.map(e => `${e.turn}|${e.role}`)).size, archived.length, 'zero duplicates');
    assert.equal(full.length, 400, 'the merged history is complete');
    assert.equal(full[0].text, 'player1');
    assert.equal(full.at(-1).text, 'gm200');
  });

  it('a failed archive write does not advance the mark — retried next save, nothing lost', async () => {
    let failNext = false;
    const db = await openCold(fakeIndexedDB({ failPuts: () => failNext }));
    const transcript = [];
    const marks = { transcript: 0, ledger: 0 };
    for (let t = 1; t <= 40; t++) {
      transcript.push(entry(t, 'player'), entry(t, 'gm'));
      failNext = (t === 30);                       // one save's archive write fails
      await saveCycle(db, transcript, marks);
    }
    failNext = false;
    const archived = await readSegments(db, 'transcript', 'run');
    const full = dedupeHistory([...archived, ...transcript.slice(-HOT.keepTranscript)]);
    assert.equal(full.length, 80, 'the failed batch must be re-archived by a later save');
    assert.equal(new Set(archived.map(e => `${e.turn}|${e.role}`)).size, archived.length);
  });

  it('an undo rewind re-archives at worst an overlap the dedupe folds away', async () => {
    const db = await openCold(fakeIndexedDB());
    let transcript = [];
    const marks = { transcript: 0, ledger: 0 };
    for (let t = 1; t <= 60; t++) {
      transcript.push(entry(t, 'player'), entry(t, 'gm'));
      await saveCycle(db, transcript, marks);
    }
    // Undo three turns: the timeline (and the recorded mark) rewind together.
    transcript = transcript.slice(0, -6);
    marks.transcript = Math.min(marks.transcript, Math.max(0, transcript.length - HOT.keepTranscript));
    // The player diverges: new turns at the same indices, different text.
    for (let t = 58; t <= 64; t++) {
      transcript.push({ role: 'player', text: `alt-p${t}`, turn: t }, { role: 'gm', text: `alt-g${t}`, turn: t });
      await saveCycle(db, transcript, marks);
    }
    const archived = await readSegments(db, 'transcript', 'run');
    const full = dedupeHistory([...archived, ...transcript.slice(-HOT.keepTranscript)]);
    // Every live entry is present exactly once; pre-undo history may linger in
    // the archive (append-only by design) but never duplicates a live entry.
    const liveKeys = transcript.map(e => `${e.turn}|${e.role}|${e.text}`);
    const fullKeys = full.map(e => `${e.turn}|${e.role}|${e.text}`);
    for (const k of liveKeys) {
      assert.equal(fullKeys.filter(x => x === k).length, 1, `live entry ${k} exactly once`);
    }
  });
});
