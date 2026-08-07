// src/game/scope-budget.js — pure token accounting for the scope packet.
//
// Split from scope.js so it can be tested without the Spektrum singleton: the
// budget is the part that has to be provable. Context creep is invisible in
// review and expensive in production — every turn of an 80-hour campaign pays
// for it — so the packet's size is asserted in CI rather than discovered on a
// bill.

// Rough estimate: JSON-heavy English runs ~3.5 characters per token. Good
// enough to hold a budget; nobody is billed from this number.
export const estimateTokens = (obj) => Math.ceil(JSON.stringify(obj ?? '').length / 3.5);

// Per-tier ceilings, in tokens. A quiet room should cost a few hundred; a
// set-piece with a dozen NPCs may cost more, but never without bound.
export const BUDGET = Object.freeze({
  here:   900,
  nearby: 200,
  region: 400,
  world:  300,
  memory: 900,
  known:  300,
});

// What the packet costs, per tier and in total, and which tiers are over.
export function scopeCost(packet) {
  const per = {};
  for (const key of Object.keys(packet ?? {})) per[key] = estimateTokens(packet[key]);
  const total = Object.values(per).reduce((a, b) => a + b, 0);
  const over  = Object.entries(BUDGET).filter(([k, max]) => (per[k] ?? 0) > max).map(([k]) => k);
  return { per, total, over };
}
