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
  const next = setActFlag(t, flag);
  return next === t ? false : (save(next), true);
}

// Complete a beat. Returns { completed, actClosed } so the caller can run the
// act-transition ceremony (and generate the next act) at the right moment.
//
// Completing a beat also settles any clue that was planted to pay off into it:
// a setup whose `paysInto` names this beat has now landed, so it stops being an
// obligation the next act has to carry.
export function completeBeat(beatId) {
  const before = thread();
  const turn   = appState.session?.turnCount ?? 0;
  let after    = completeActBeat(before, beatId, { turn });
  if (after === before) return { completed: false, actClosed: false };

  for (const setup of after.payoffs.filter(p => !p.paid && p.paysInto === beatId)) {
    after = paySetup(after, setup.id, { turn });
  }

  save(after);
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

// Clues the GM is currently carrying: planted, not yet paid off. These go into
// the narrator's GM-private slice so it can seed them naturally over several
// scenes — a setup the player is *told* about is not foreshadowing.
export function activeSetups() {
  return thread().payoffs.filter(p => !p.paid).map(p => p.clue).filter(Boolean);
}

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

// Store a generated act and make it current.
//
// An act also plants its foreshadowing: each `setup` is a clue this act drops
// that a LATER act has to pay off. Without this the payoff ledger never
// receives anything, `duePayoffs` is permanently empty, and the generator's
// "unpaidSetups MUST be paid off" instruction is addressed to an empty list.
export function adoptAct(generated) {
  if (!generated?.beats?.length) return null;
  const t = thread();
  const actNo = t.acts.length + 1;
  const act = makeAct({
    id:      `act-${actNo}`,
    title:   generated.title   ?? `Act ${actNo}`,
    premise: generated.premise ?? '',
    beats:   generated.beats,
  });

  save(pushAct(t, act));

  // Planting goes through plantClue so there is exactly one way a setup enters
  // the ledger — an act transition happens a handful of times per campaign, so
  // the per-clue write costs nothing and a single path cannot drift.
  for (const s of generated.setups ?? []) {
    if (!s?.id || !s?.clue) continue;
    plantClue({
      id:       `${act.id}.${s.id}`,
      clue:     s.clue,
      paysInto: s.paysInto ?? null,
      // Unstated deadlines default to the next act: a clue that can be deferred
      // forever is how the audit's "cosmetic" foreshadowing happened.
      dueByAct: s.dueByAct ?? actNo + 1,
    });
  }

  return act;
}
