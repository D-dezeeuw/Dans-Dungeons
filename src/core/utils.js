// src/core/utils.js — pure helpers with no side effects

export function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Append cursor for arrays living behind a deferred-write store. Spektrum
// batches setValue until tick(), so the visible array length is FROZEN across
// a synchronous multi-write window — deriving an append index from it wrote
// every patch of a window to the SAME slot, last-write-wins (the 2026-08-09
// audit's F1: three ledger appends in one turn kept one entry). The cursor
// counts pending appends on top of the last seen length and resyncs whenever
// the visible length changes — a tick landed, or time travel rewound the
// array. Pure and store-agnostic so the seam is testable under node against
// the real Spektrum.
export function makeAppendCursor() {
  let seenLen = -1;
  let pending = 0;
  return function nextIndex(visibleLength) {
    if (visibleLength !== seenLen) { seenLen = visibleLength; pending = 0; }
    return visibleLength + pending++;
  };
}

// Credential stripping for anything that leaves the browser. A save snapshot
// hides `ai` in TWO places: the top level, and the time-travel blob's epoch
// root (a full PERSIST_KEYS clone). Stripping only the top level shipped the
// live OpenRouter key inside `_timeTravel.root` of every mid-play export —
// and let an imported file's root re-apply a hostile baseUrl (audit S1).
// Pure and exported from here so the save boundary is testable under node.
const CREDENTIAL_FIELDS = ['key', 'baseUrl'];

export function stripCredentials(snapshot) {
  if (!snapshot?.ai) return snapshot;
  const ai = { ...snapshot.ai };
  for (const f of CREDENTIAL_FIELDS) delete ai[f];
  return { ...snapshot, ai };
}

export function stripSaveCredentials(snapshot) {
  let out = stripCredentials(snapshot);
  if (out?._timeTravel?.root) {
    out = { ...out, _timeTravel: { ...out._timeTravel, root: stripCredentials(out._timeTravel.root) } };
  }
  return out;
}
