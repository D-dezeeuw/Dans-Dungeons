// src/ai/spend.js — real cumulative AI spend, OUTSIDE Spektrum history.
//
// `ai.totalTokens` / `ai.totalCostUsd` are recorded via addValue, so a
// time-travel undo REWINDS them — useful as a "cost of this timeline" figure,
// but it undercounts the money actually spent with the player's key. This
// accumulator is deliberately NOT recorded (it never calls setValue): it lives
// in a module variable + localStorage, so it survives undo/redo, branch swaps,
// and reloads, and only ever grows. The cost meter shows THIS number; the
// per-timeline figure stays in appState.ai for debugging.

const KEY        = 'dans-dungeons-spend';
const BUDGET_KEY = 'dans-dungeons-budget';

// Which tiers get their own line in the breakdown. `image` is here because it
// is the one that surprises people: a sketch costs roughly 47x the text it
// illustrates, and until the meter said so nobody could see it.
export const TIERS = ['tiny', 'medium', 'large', 'image', 'tts', 'stt'];

let _spend = load();
const _listeners = [];

function emptyByTier() {
  return Object.fromEntries(TIERS.map(k => [k, { tokens: 0, costUsd: 0 }]));
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && typeof raw.tokens === 'number' && typeof raw.costUsd === 'number') {
      // byTier arrived after the first saves did; fill it in rather than
      // discarding a player's accumulated total over a missing field.
      return { ...raw, byTier: { ...emptyByTier(), ...(raw.byTier ?? {}) } };
    }
  } catch { /* absent or corrupt — start fresh */ }
  return { tokens: 0, costUsd: 0, byTier: emptyByTier() };
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(_spend)); } catch { /* quota — skip */ }
}

// Add real spend (tokens and/or USD), attributed to a tier when the caller
// knows it. Monotonic; never decremented. Notifies listeners so the meter
// refreshes imperatively.
export function addSpend(tokens = 0, costUsd = 0, tier = null) {
  if (!tokens && !costUsd) return;
  const byTier = { ...(_spend.byTier ?? emptyByTier()) };
  if (tier && byTier[tier]) {
    byTier[tier] = { tokens: byTier[tier].tokens + tokens, costUsd: byTier[tier].costUsd + costUsd };
  }
  _spend = { tokens: _spend.tokens + tokens, costUsd: _spend.costUsd + costUsd, byTier };
  persist();
  for (const fn of _listeners) fn(_spend);
}

export function getSpend() { return _spend; }

export function onSpendChange(fn) { _listeners.push(fn); }

// ─── Session budget ──────────────────────────────────────────────────────────
//
// A soft cap, deliberately: the game warns and keeps playing rather than
// stopping a campaign mid-sentence because a number was crossed. Hard-stopping
// someone's session over their own spending limit is the kind of help nobody
// asked for; knowing they crossed it is.

function loadBudget() {
  try {
    const raw = JSON.parse(localStorage.getItem(BUDGET_KEY));
    if (raw && typeof raw.capUsd === 'number') return raw;
  } catch { /* none set */ }
  return { capUsd: 0, warnedAt: 0 };
}

let _budget = loadBudget();

// 0 (or negative) disables the cap.
export function setBudget(capUsd) {
  _budget = { capUsd: Number(capUsd) || 0, warnedAt: 0 };
  try { localStorage.setItem(BUDGET_KEY, JSON.stringify(_budget)); } catch { /* quota */ }
  return _budget;
}

export function getBudget() { return _budget; }

// Fraction of the cap spent (0–1+), or null when no cap is set.
export function budgetUsed() {
  if (!(_budget.capUsd > 0)) return null;
  return _spend.costUsd / _budget.capUsd;
}

// True at most once per threshold crossing, so the warning does not repeat on
// every turn after the cap. Thresholds are 80% and 100%.
export function budgetWarningDue() {
  const used = budgetUsed();
  if (used == null) return null;
  const level = used >= 1 ? 100 : used >= 0.8 ? 80 : 0;
  if (!level || level <= _budget.warnedAt) return null;
  _budget = { ..._budget, warnedAt: level };
  try { localStorage.setItem(BUDGET_KEY, JSON.stringify(_budget)); } catch { /* quota */ }
  return { level, spentUsd: _spend.costUsd, capUsd: _budget.capUsd };
}
