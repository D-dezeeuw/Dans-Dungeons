// src/game/acts-runtime.js — the red thread, running on acts (Epic E7 wiring).
//
// The library ships an acts runtime (successors, stalls, payoffs) and the game
// ran a simpler linear beat list beside it — the exact "machinery without a
// consumer" split the audit named. This module is the consumer.
//
// It adapts in both directions so no save is stranded: an existing campaign's
// flat `world.redThread.beats` is read as act 1, and everything from here on is
// stored as acts. When an act completes, the next one is generated from what
// ACTUALLY happened — the ledger, the faction standings, the unpaid setups —
// which is what lets a memorable side thread be promoted into the main line.

import {
  emptyThread, pushAct, makeAct, currentAct, activeActBeat, completeActBeat,
  setActFlag, isStalled, plantSetup, paySetup, duePayoffs, threadProgress, directive,
} from 'bag-of-holding-client';
import { appState, setValue, tick } from '../core/state.js';
import { recentEvents } from './ledger.js';
import { reputationStanding } from './story.js';

// How many acts a campaign runs before its finale. Five acts of six-ish beats
// is the shape the plan targets for 80 hours; the last one is the climax.
export const TARGET_ACTS = 5;

// ─── Thread access (migrating legacy saves on read) ──────────────────────────

export function thread() {
  const stored = appState.world?.thread;
  if (stored?.acts) return stored;

  // Legacy: a flat beat list with no act structure. Read it as act 1 so an
  // in-flight campaign keeps its progress instead of restarting its story.
  const rt = appState.world?.redThread;
  if (!rt?.beats?.length) return emptyThread();
  const act = makeAct({
    id: 'act-1',
    title: rt.title ?? 'Act One',
    premise: rt.premise ?? appState.world?.digest ?? '',
    beats: rt.beats,
  });
  const migrated = pushAct(emptyThread(), act);
  return { ...migrated, flags: { ...rt.flags } };
}

function save(next) {
  setValue('world.thread', next);
  tick();
  return next;
}

// ─── The turn-loop surface ───────────────────────────────────────────────────

export function activeBeat()      { return activeActBeat(thread()); }
export function gmDirective()     { return directive(thread()); }
export function progress()        { return threadProgress(thread()); }
export function actNumber()       { return thread().actIndex + 1; }

export function raiseFlag(flag) {
  const t = thread();
  // The turn travels with the flag: progress restarts the stall clock from
  // NOW (the old call made the detector measure from turn 0, so any late-game
  // flag instantly read as a stall and fired a spurious escalation).
  const next = setActFlag(t, flag, { turn: appState.session?.turnCount ?? 0 });
  return next === t ? false : (save(next), true);
}

// Complete a beat. Returns { completed, actClosed } so the caller can run the
// act-transition ceremony (and generate the next act) at the right moment.
// Completing a beat also pays any setup that was planted to pay into it.
export function completeBeat(beatId) {
  const before = thread();
  const turn   = appState.session?.turnCount ?? 0;
  const after  = completeActBeat(before, beatId, { turn });
  if (after === before) return { completed: false, actClosed: false };
  save(after);
  for (const setup of duePayoffs(after)) {
    if (setup.paysInto === beatId) payClue(setup.id);
  }
  return { completed: true, actClosed: after.actIndex > before.actIndex };
}

// ─── Foreshadowing ───────────────────────────────────────────────────────────

export function plantClue({ id, clue, paysInto = null, dueByAct = null }) {
  const next = plantSetup(thread(), { id, clue, paysInto, dueByAct, turn: appState.session?.turnCount ?? 0 });
  return next === thread() ? false : (save(next), true);
}

export function payClue(id) {
  save(paySetup(thread(), id, { turn: appState.session?.turnCount ?? 0 }));
}

export function unpaidSetups() { return duePayoffs(thread()); }

// ─── Flag-primary completion ─────────────────────────────────────────────────
//
// A beat that turns on something the dice decided — a boss killed, a gate
// opened, a settlement reached — is already known to be over. Asking a tiny
// model to confirm it is a paid call to learn what the game just wrote down,
// and a judge that keeps answering "no" can freeze a campaign with no way out.
// The LLM judge is now the fallback for beats about conversations, discoveries
// and choices, which is what it was always good at.

// Does the active beat's `completesOn` sit entirely inside the raised flags?
// Returns the beat id to complete, or null.
export function beatSatisfiedByFlags() {
  const t = thread();
  const beat = activeActBeat(t);
  const on = beat?.completesOn;
  if (!beat || !Array.isArray(on) || !on.length) return null;
  const flags = t.flags ?? {};
  return on.every(f => flags[f]) ? beat.id : null;
}

// ─── Stalls ──────────────────────────────────────────────────────────────────

// Has the story stopped moving? The caller escalates — the world comes to the
// player — rather than letting a thread freeze, which judge-only progression
// used to allow indefinitely.
export function storyStalled({ patience = 60 } = {}) {
  return isStalled(thread(), { turn: appState.session?.turnCount ?? 0, patience });
}

// ─── Act generation context ──────────────────────────────────────────────────

// What the next act must be built from: the campaign so far, in facts. This is
// the difference between a story that reacts to the player and one that ignores
// them — the generator sees what actually happened, including anything the
// Game Master invented along the way.
export function nextActContext() {
  const t = thread();
  const world = appState.world ?? {};
  const factions = Object.keys(world.factionReputation ?? {})
    .map(id => ({ faction: world.factions?.[id]?.name ?? id, standing: reputationStanding(id) }))
    .filter(f => f.standing !== 'neutral');

  return {
    actNumber:   t.actIndex + 1,
    finalAct:    t.actIndex + 1 >= TARGET_ACTS,
    worldDigest: world.digest ?? '',
    tone:        world.tone ?? null,
    previousActs: t.acts.map(a => ({ title: a.title, premise: a.premise })),
    whatHappened: recentEvents({ limit: 12, minScope: 'regional' }).map(e => e.because),
    factions,
    // Clues planted and never paid off — the next act has to use or abandon them.
    unpaidSetups: duePayoffs(t).map(p => p.clue),
    // Named things the world has acquired, so a generated act can cast people
    // and places the player already cares about.
    knownPlaces: Object.values(world.settlements ?? {}).map(s => s.name).filter(Boolean).slice(0, 6),
  };
}

// Store a generated act and make it current — and plant its foreshadowing.
// The generator now proposes `setups`; planting them here is what turned the
// payoff ledger from an exported orphan into a channel with a producer.
export function adoptAct(generated) {
  if (!generated?.beats?.length) return null;
  const t = thread();
  const actNumber = t.acts.length + 1;
  const act = makeAct({
    id:      `act-${actNumber}`,
    title:   generated.title   ?? `Act ${actNumber}`,
    premise: generated.premise ?? '',
    beats:   generated.beats,
  });
  // The six generic completesOn signals are PER-ACT events: flags are sticky,
  // so without this reset a new act's "reach a settlement" or "slay the boss"
  // beat would complete instantly off something the player did an act ago.
  // Specific flags (visited-<id>, boss-<id>-slain, beat-done-*) persist.
  const GENERIC_SIGNALS = ['enemy-slain', 'boss-slain', 'treasure-taken',
                           'gate-unlocked', 'settlement-reached', 'region-reached'];
  const flags = { ...t.flags };
  for (const f of GENERIC_SIGNALS) delete flags[f];
  save(pushAct({ ...t, flags }, act));
  for (const [i, setup] of (generated.setups ?? []).entries()) {
    plantClue({
      id:       `setup-act${actNumber}-${i + 1}`,
      clue:     setup.clue,
      paysInto: setup.paysInto ?? null,
      // A clue paying into this act is due here; an open-ended one is due by
      // the NEXT act, so generation must weave it in or abandon it on record.
      dueByAct: setup.paysInto ? actNumber : actNumber + 1,
    });
  }
  return act;
}
