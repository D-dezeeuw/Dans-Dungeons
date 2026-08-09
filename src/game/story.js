// src/game/story.js — narrative engine glue (Phase 4).
//
// Wires the pure beat evaluator (beats.js) and faction math (factions.js) to
// Spektrum state. loop.js uses this to set flags, advance beats, and build the
// narrator's story-context block; flow.js uses it to award reputation, read
// standings (dialogue tone, shop prices), and render the /story view.
//
// All writes go through setValue + tick so the change is live before the next
// read or save (Spektrum merges deltas on tick()). They target narrow sub-paths
// (world.redThread, world.factionReputation), not the whole `world` — these now
// land in the time-travel spine each story turn, so keeping the recorded entry
// small matters (same rationale as resolver.js's commitAll). Deep-merge makes a
// narrow write identical in result to the old whole-world spread.

import { appState, setValue, tick } from '../core/state.js';
import { adjustReputation, standingFor } from 'bag-of-holding-client';
import {
  activeBeat as actsActiveBeat, completeBeat as actsCompleteBeat, raiseFlag,
  progress as actsProgress, gmDirective, unpaidSetups,
} from './acts-runtime.js';

// ─── Story flags ──────────────────────────────────────────────────────────────

// Flags are the PRIMARY completion signal: mechanical events raise them, so a
// beat finishes because something happened rather than because a language model
// was asked whether the scene felt finished.
//
// An act can close on this path — the designed COMMON case: the act's last
// beat completes on a mechanical flag like `boss-slain`. The closure used to
// be discarded here, so the next act was never generated and the campaign's
// story silently stopped. setStoryFlag is sync (called mid-commit); act
// generation is an async LLM call — so the closure is queued, and the turn
// loop drains it with `takePendingActClose()` at its async seam.
let _pendingActClose = false;

export function setStoryFlag(flag) {
  raiseFlag(flag);
  const { actClosed } = autoCompleteFlaggedBeats();
  if (actClosed) _pendingActClose = true;
}

export function takePendingActClose() {
  const pending = _pendingActClose;
  _pendingActClose = false;
  return pending;
}

// Put a taken close back. Two callers: a failed act generation (the close
// must survive to retry next turn, not die with one bad LLM response), and
// the resume healer (the queue is module-local, so a close taken to a reload
// — e.g. raised in a settlement, where no turn loop drains it — was lost and
// the thread stranded actless; audit F3).
export function requeueActClose() { _pendingActClose = true; }

// A beat whose `completesOn` flags are ALL raised is done. This is what
// demotes the LLM judge to a fallback. `completesOn` is an array per the act
// schema — the old scalar read (`flags[completesOn]`) coerced the array to a
// string, so only single-element arrays ever matched, by accident.
function autoCompleteFlaggedBeats() {
  const beat = actsActiveBeat();
  if (!beat) return { completed: false, actClosed: false };
  const need = Array.isArray(beat.completesOn)
    ? beat.completesOn
    : (beat.completesOn ?? beat.flag) ? [beat.completesOn ?? beat.flag] : [];
  if (!need.length) return { completed: false, actClosed: false };
  const flags = appState.world?.thread?.flags ?? {};
  if (!need.every(f => !!flags[f])) return { completed: false, actClosed: false };
  return actsCompleteBeat(beat.id);
}

// ─── Beats ──────────────────────────────────────────────────────────────────

// The red thread now runs on ACTS (src/game/acts-runtime.js), which the library
// ships and the game previously ignored in favour of a flat beat list. The acts
// runtime migrates a legacy `redThread` on read, so an in-flight campaign keeps
// its progress. These wrappers keep the old call sites working.
export function activeBeat() {
  return actsActiveBeat();
}

// Returns { completed, actClosed } — flow.js runs the act-transition ceremony
// (and generates the next act) when an act closes.
export function completeBeatNow(beatId) {
  return actsCompleteBeat(beatId);
}

// ─── Faction reputation ───────────────────────────────────────────────────────

export function awardReputation(factionId, delta) {
  if (!factionId || !delta) return;
  const map = appState.world?.factionReputation ?? {};
  setValue('world.factionReputation', adjustReputation(map, factionId, delta));
  tick();
}

export function reputationStanding(factionId) {
  return standingFor(appState.world?.factionReputation, factionId);
}

// ─── Narrator story-context block (Phase 4.10) ────────────────────────────────
// Compact (< ~400 tokens): the current beat's dramatic purpose is the GM's
// private directive; faction tensions, active quests, and recent flags give the
// narrator continuity. Kept small on purpose.

export function buildStoryContext() {
  const rt = appState.world?.thread ?? appState.world?.redThread;
  const beat = actsActiveBeat();
  const repMap = appState.world?.factionReputation ?? {};
  const factions = Object.keys(repMap)
    .map(id => ({ faction: appState.world?.factions?.[id]?.name ?? id, standing: standingFor(repMap, id) }))
    .filter(f => f.standing !== 'neutral')
    .slice(0, 4);
  const quests = Object.values(appState.world?.quests ?? {})
    .filter(q => q.status === 'active')
    .map(q => q.description)
    .slice(0, 3);
  const recentFlags = Object.keys(rt?.flags ?? {})
    .filter(f => !f.startsWith('beat-done-'))
    .slice(-6);

  const ctx = {};
  const d = gmDirective();
  if (d?.purpose)  ctx.directive = d.purpose;   // GM-only: steer toward this, never state it
  if (d?.location) ctx.preferredLocation = d.location;
  if (factions.length) ctx.factions = factions;
  if (quests.length) ctx.activeQuests = quests;
  if (recentFlags.length) ctx.recentEvents = recentFlags;
  // Clues that were planted and have not paid off yet. The narrator gets them
  // so it can seed and echo them in passing — a foreshadow nobody ever mentions
  // again is just a sentence, and the payoff ledger was tracking obligations
  // that no prompt could act on.
  const setups = unpaidSetups().map(p => p.clue).filter(Boolean).slice(0, 4);
  if (setups.length) ctx.activeSetups = setups;
  return Object.keys(ctx).length ? ctx : null;
}

// ─── Story progress (for the /story view) ─────────────────────────────────────

export function progress() {
  return actsProgress();
}
