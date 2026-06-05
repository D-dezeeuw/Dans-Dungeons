// src/game/story.js — narrative engine glue (Phase 4).
//
// Wires the pure beat evaluator (beats.js) and faction math (factions.js) to
// Spektrum state. loop.js uses this to set flags, advance beats, and build the
// narrator's story-context block; flow.js uses it to award reputation, read
// standings (dialogue tone, shop prices), and render the /story view.
//
// All writes go through setValue + tick so the change is live before the next
// read or save (Spektrum merges deltas on tick()).

import { appState, setValue, tick } from '../core/state.js';
import { currentBeat, completeBeat, setFlag as setBeatFlag, storyProgress } from './beats.js';
import { adjustReputation, standingFor, reputationOf } from './factions.js';

const emptyRT = () => ({ beats: [], currentIndex: 0, flags: {} });

// ─── Story flags ──────────────────────────────────────────────────────────────

export function setStoryFlag(flag) {
  const rt = appState.world?.redThread ?? emptyRT();
  const next = setBeatFlag(rt, flag);
  if (next === rt) return;
  setValue('world', { ...appState.world, redThread: next });
  tick();
}

export function hasFlag(flag) {
  return !!(appState.world?.redThread?.flags ?? {})[flag];
}

// ─── Beats ──────────────────────────────────────────────────────────────────

export function activeBeat() {
  return currentBeat(appState.world?.redThread);
}

export function completeBeatNow(beatId) {
  const rt = appState.world?.redThread ?? emptyRT();
  const next = completeBeat(rt, beatId);
  if (next === rt) return false;
  setValue('world', { ...appState.world, redThread: next });
  tick();
  return true;
}

// ─── Faction reputation ───────────────────────────────────────────────────────

export function awardReputation(factionId, delta) {
  if (!factionId || !delta) return;
  const map = appState.world?.factionReputation ?? {};
  setValue('world', { ...appState.world, factionReputation: adjustReputation(map, factionId, delta) });
  tick();
}

export function reputationStanding(factionId) {
  return standingFor(appState.world?.factionReputation, factionId);
}

export function reputationValue(factionId) {
  return reputationOf(appState.world?.factionReputation, factionId);
}

// ─── Narrator story-context block (Phase 4.10) ────────────────────────────────
// Compact (< ~400 tokens): the current beat's dramatic purpose is the GM's
// private directive; faction tensions, active quests, and recent flags give the
// narrator continuity. Kept small on purpose.

export function buildStoryContext() {
  const rt = appState.world?.redThread;
  const beat = currentBeat(rt);
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
  if (beat?.dramaticPurpose) ctx.directive = beat.dramaticPurpose; // GM-only: steer toward this, don't state it outright
  if (beat?.preferredLocation) ctx.preferredLocation = beat.preferredLocation;
  if (factions.length) ctx.factions = factions;
  if (quests.length) ctx.activeQuests = quests;
  if (recentFlags.length) ctx.recentEvents = recentFlags;
  return Object.keys(ctx).length ? ctx : null;
}

// ─── Story progress (for the /story view) ─────────────────────────────────────

export function progress() {
  return storyProgress(appState.world?.redThread);
}
