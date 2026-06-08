// src/ai/spend.js — real cumulative AI spend, OUTSIDE Spektrum history.
//
// `ai.totalTokens` / `ai.totalCostUsd` are recorded via addValue, so a
// time-travel undo REWINDS them — useful as a "cost of this timeline" figure,
// but it undercounts the money actually spent with the player's key. This
// accumulator is deliberately NOT recorded (it never calls setValue): it lives
// in a module variable + localStorage, so it survives undo/redo, branch swaps,
// and reloads, and only ever grows. The cost meter shows THIS number; the
// per-timeline figure stays in appState.ai for debugging.

const KEY = 'dans-dungeons-spend';
let _spend = load();
const _listeners = [];

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && typeof raw.tokens === 'number' && typeof raw.costUsd === 'number') return raw;
  } catch { /* absent or corrupt — start fresh */ }
  return { tokens: 0, costUsd: 0 };
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(_spend)); } catch { /* quota — skip */ }
}

// Add real spend (tokens and/or USD). Monotonic; never decremented. Notifies
// listeners so the meter refreshes imperatively.
export function addSpend(tokens = 0, costUsd = 0) {
  if (!tokens && !costUsd) return;
  _spend = { tokens: _spend.tokens + tokens, costUsd: _spend.costUsd + costUsd };
  persist();
  for (const fn of _listeners) fn(_spend);
}

export function getSpend() { return _spend; }

export function onSpendChange(fn) { _listeners.push(fn); }
