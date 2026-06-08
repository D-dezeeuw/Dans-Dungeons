// src/game/undo.js — time-travel "undo / redo" across turns via Spektrum.
//
// A turn is bracketed by a mark: beginTurn() captures the pre-turn history index
// + the current play-context signature WITHOUT writing anything; finalizeTurn()
// registers it only AFTER the turn has fully committed (so a turn that throws
// mid-flight — e.g. an AI error — never leaves a dangling time-travel affordance).
//
// We keep an ordered list of turn-boundary history indices (`_stops`) plus a
// cursor (`_pos`) into it. `_stops[k]` is the history index of the state "after
// k committed turns"; `_stops[0]` is the epoch root. undo moves `_pos` back one
// stop and replay()s there; redo moves it forward. replay(n) re-applies the
// first n recorded mutations — it does NOT re-run the turn loop or re-roll dice,
// so scrubbing is exact and free, with no AI cost.
//
// DIVERGENCE / BRANCHES (Phase 2) — issuing a NEW turn while scrubbed back
// (`_pos` not at the head) discards the now-stale redo stops here, while
// Spektrum forks the abandoned history tail. The `onFork` hook captures that
// tail into an epoch-scoped `_branches` registry, labelled with the action that
// started the path not taken. jumpToBranch() swaps the live state onto a stored
// branch by replaying to its divergence point and re-recording its entries —
// which forks (and so re-captures) the path being left, making branch hops
// symmetric. Branches are in-memory only and reset on every epoch boundary
// (persisting them across reloads is Phase 4).
//
// NO RECORDED WRITES AFTER replay() — replay() leaves the engine cursor at the
// replayed index, so any setValue/addValue/checkpoint afterwards would record a
// new entry mid-history and fork away the redo tail. The undo/redo button
// visibility is therefore driven imperatively (a third imperative surface
// alongside the transcript DOM and the compass), never via recorded `ui.*`
// state. Reactive bindings (header stats, {{turn}} counter, data-each clouds)
// re-fire on their own inside replay(); the scene sketch lives in localStorage
// (not history) and is intentionally left untouched.
//
// CONTEXT SCOPING — time-travel must never replay across a world swap. The game
// rewrites appState.world wholesale on dungeon/settlement transitions and around
// transient overworld encounters; replaying a stale dungeon stop from a town
// would wipe accumulated progress and persist a desynced world. Two safeguards:
//   1. No marks are taken inside encounters (the world is swapped out there).
//   2. Every epoch carries a context signature (location type + dungeon/
//      settlement id); undo/redo refuse and drop the stale timeline if the
//      signature no longer matches. enterDungeon()/renderSettlement() also clear
//      the timeline on entry so the buttons hide promptly. The timeline is
//      in-memory only, so a reload starts clean and a scrub can never cross a
//      game boundary into stale history.

import { appState, setValue, addValue, tick, replay, checkpoint, onFork,
         spektrumHistory, saveToStorage } from '../core/state.js';
import { rebuildTranscript } from '../ui/transcript.js';
import { updateActionBar }   from '../ui/actionbar.js';

// Turn-boundary history indices for the current epoch (ascending). `_pos` is the
// index into `_stops` of the state we are currently sitting at; `_epochSig` is
// the context signature shared by every stop in this epoch.
let _stops    = [];
let _pos      = 0;
let _epochSig = null;

// Abandoned timelines captured for the current epoch: { id, label, turns,
// entries, ts }. `entries` is the FULL branch from the epoch root (not just the
// dropped tail), so a swap always replays to the always-stable root and never
// depends on a history index that a later truncation could invalidate.
// `_branchSeq` mints stable ids; `_listeners` are UI refresh callbacks
// (ui/branches.js + ui/timeline.js register them, avoiding an import cycle).
let _branches  = [];
let _branchSeq = 0;
let _listeners = [];

// Signature of the current undoable play context. Room moves within one dungeon
// keep this stable (only location, not currentRoom, is included), so time-travel
// works across a move; any world swap (dungeon↔settlement, into/out of an
// encounter) changes it.
function contextSig() {
  const loc = appState.world?.location ?? {};
  return `${loc.type ?? ''}|${loc.dungeonId ?? ''}|${loc.settlementId ?? ''}`;
}

// Capture the pre-turn state pointer without side effects. Returns a pending
// mark, or null when time-travel doesn't apply to this turn (transient
// encounters).
export function beginTurn() {
  if (appState.world?.location?.type === 'encounter') return null;
  return { index: spektrumHistory.length, sig: contextSig() };
}

// Register the committed turn — call ONLY after the turn has committed. A no-op
// for the null mark from beginTurn(), so encounter turns and pre-commit throws
// register nothing. Starts a fresh timeline on the first turn of an epoch (or
// when the context changed); on a post-undo divergence it drops the stale redo
// stops before appending the new head.
export function finalizeTurn(mark) {
  if (!mark) return;
  if (!_stops.length || _epochSig !== mark.sig) {
    _epochSig = mark.sig;
    _stops    = [mark.index];   // epoch root — the state before this turn
    _pos      = 0;
  } else if (_pos < _stops.length - 1) {
    _stops.length = _pos + 1;   // diverged after an undo — forget the dropped future
  }
  checkpoint('turn');           // tag the boundary (records at the head — no fork)
  _stops.push(spektrumHistory.length);
  _pos = _stops.length - 1;
  refreshButtons();
  notify();
}

// Roll back one marked turn. Returns false when nothing is undoable. Refuses to
// run mid-turn (the command input is disabled while a turn is processed —
// replaying then would race the in-flight commit) and refuses (then drops the
// now-stale timeline) if the play context changed since the epoch started.
export function undoLastTurn() {
  if (_pos <= 0) return false;
  if (document.getElementById('cmd')?.disabled) return false;
  if (_epochSig !== contextSig()) { clearTurnMarks(); return false; }
  _pos -= 1;
  scrubTo(_stops[_pos]);
  return true;
}

// Re-apply one undone turn. Mirror of undoLastTurn in the forward direction;
// available only while there is an un-diverged future to replay.
export function redoLastTurn() {
  if (_pos >= _stops.length - 1) return false;
  if (document.getElementById('cmd')?.disabled) return false;
  if (_epochSig !== contextSig()) { clearTurnMarks(); return false; }
  _pos += 1;
  scrubTo(_stops[_pos]);
  return true;
}

// Jump directly to any turn boundary on the current branch (powers the timeline
// scrubber, and undo/redo as the ±1 cases). Same guards as undo/redo.
export function jumpToStop(index) {
  if (index < 0 || index >= _stops.length || index === _pos) return false;
  if (document.getElementById('cmd')?.disabled) return false;
  if (_epochSig !== contextSig()) { clearTurnMarks(); return false; }
  _pos = index;
  scrubTo(_stops[_pos]);
  return true;
}

// Shared scrub: replay to a stop, redraw the imperative surfaces, refresh the
// buttons + listeners, persist. No recorded writes happen here (see the header).
function scrubTo(index) {
  replay(index);            // reactive bindings re-fire automatically
  rebuildTranscript();      // transcript DOM is imperative — redraw it
  redrawCompass();          // compass is imperative — redraw for the reverted room
  refreshButtons();
  notify();
  saveToStorage();
}

// Forget the whole timeline AND the captured branches (new game, or a
// play-context transition). Hides both buttons and clears the branch picker.
export function clearTurnMarks() {
  _stops    = [];
  _pos      = 0;
  _epochSig = null;
  _branches = [];
  refreshButtons();
  notify();
}

// ─── Branches (Phase 2) ────────────────────────────────────────────────────────

// onFork handler — Spektrum hands us the dropped tail whenever a mutation while
// scrubbed back diverges the timeline (a post-undo new turn, or the re-record
// inside jumpToBranch). Keep only tails belonging to the current epoch. replay()
// never fires onFork, so undo/redo scrubs do not land here.
function captureFork(fork) {
  if (!_stops.length)              return;   // no active epoch
  if (fork.forkedAt < _stops[0])   return;   // belongs to a previous epoch
  // Store the FULL branch from the epoch root: the still-intact shared prefix
  // [root, forkedAt) plus the dropped tail. (At onFork time Spektrum has already
  // truncated history to forkedAt, so the slice is exactly the shared prefix.)
  // Root-relative entries make jumpToBranch replay to the stable root, immune to
  // index shifts from later swaps.
  const root  = _stops[0];
  const entries = spektrumHistory.slice(root, fork.forkedAt).concat(fork.entries);
  _branches.push({
    id:      `b${_branchSeq++}`,
    label:   labelFork(fork),
    turns:   countTurns(entries),
    entries,
    ts:      fork.ts,
  });
  notify();
}

// Count the 'turn' checkpoints in an entry list — the number of committed turns
// the branch holds (shown in the picker / timeline).
function countTurns(entries) {
  return entries.reduce((n, e) => n + (e.op === 'checkpoint' && e.id === 'turn' ? 1 : 0), 0);
}

// Derive a human label from a dropped tail: the player action that started the
// abandoned path (the first player line in its first transcript write).
function labelFork(fork) {
  for (const e of fork.entries) {
    if (e.path === 'transcript' && Array.isArray(e.value)) {
      const player = [...e.value].reverse().find(x => x?.role === 'player');
      if (player?.text) return player.text;
    }
  }
  return 'an earlier path';
}

// Swap the live state onto a stored branch. Replays to the epoch ROOT (always
// stable — never truncated) and re-records the branch's full root-relative
// entries; that re-record forks (and captureFork keeps) the path being left, so
// hops are symmetric and safe at any tree depth. Refuses mid-turn or across a
// world swap, mirroring undo/redo. Returns false when the id is unknown/refused.
export function jumpToBranch(id) {
  const idx = _branches.findIndex(b => b.id === id);
  if (idx < 0) return false;
  if (document.getElementById('cmd')?.disabled) return false;
  if (_epochSig !== contextSig()) { clearTurnMarks(); return false; }

  const branch = _branches.splice(idx, 1)[0];   // consumed; the path we leave is re-captured by captureFork
  replay(_stops[0]);                             // rewind to the epoch root (replay fires no onFork)
  reapplyEntries(branch.entries);                // re-record the full branch → forks the live tail → captureFork keeps it
  tick();                                        // merge the re-applied delta into appState
  rebuildStops();                                // recompute _stops/_pos from the now-live 'turn' checkpoints
  rebuildTranscript();
  redrawCompass();
  refreshButtons();
  notify();
  saveToStorage();
  return true;
}

// Re-record a dropped tail's entries onto the live timeline (used by the swap).
function reapplyEntries(entries) {
  for (const e of entries) {
    if (e.op === 'checkpoint')    checkpoint(e.id, e.value);
    else if (e.op === 'add')      addValue(e.path, e.value, e.id);
    else                          setValue(e.path, e.value, e.id);
  }
}

// Recompute the turn-boundary stops from the live history after a swap: the
// epoch root, then the index just past each 'turn' checkpoint at or above it.
// Lands `_pos` at the head of the swapped-in branch.
function rebuildStops() {
  const root  = _stops[0] ?? 0;
  const stops = [root];
  spektrumHistory.forEach((e, i) => {
    if (e.op === 'checkpoint' && e.id === 'turn' && i >= root) stops.push(i + 1);
  });
  _stops = stops;
  _pos   = _stops.length - 1;
}

// Snapshot of the current epoch's branches for the picker UI — newest first,
// metadata only (entries stay internal).
export function listBranches() {
  return _branches.map(b => ({ id: b.id, label: b.label, turns: b.turns, ts: b.ts })).reverse();
}

// The current branch's turn timeline for the scrubber UI: one node per stop
// (Start, then each committed turn) with its action label and which is current.
export function listTimeline() {
  return _stops.map((_, k) => ({
    index:   k,
    label:   k === 0 ? null : (turnLabelBetween(_stops[k - 1], _stops[k]) ?? `Turn ${k}`),
    current: k === _pos,
  }));
}

// The player action that opened turn k — the first player line in the first
// transcript write recorded between two stops.
function turnLabelBetween(from, to) {
  for (let i = from; i < to; i++) {
    const e = spektrumHistory[i];
    if (e?.path === 'transcript' && Array.isArray(e.value)) {
      const player = [...e.value].reverse().find(x => x?.role === 'player');
      if (player?.text) return player.text;
    }
  }
  return null;
}

// Register a UI refresh callback, fired on every time-travel change (new turn,
// scrub, branch swap, epoch reset). ui/branches.js + ui/timeline.js subscribe;
// keeping the registry here avoids an undo→ui import cycle.
export function onTimeTravelChange(fn) { _listeners.push(fn); }

function notify() { for (const fn of _listeners) fn(); }

function redrawCompass() {
  if (!appState.settings?.actionBar) return;
  const roomId = appState.world?.currentRoom;
  const exits  = appState.world?.rooms?.[roomId]?.exits ?? [];
  updateActionBar(exits);
}

// Imperatively toggle the undo/redo buttons. Inline display beats the stylesheet,
// so this stays robust regardless of how `.input-icon-btn` is laid out, and it
// records nothing — the timeline is never polluted by a button refresh.
function refreshButtons() {
  setBtn('undo-btn', _pos > 0);
  setBtn('redo-btn', _pos < _stops.length - 1);
}

function setBtn(id, show) {
  const btn = typeof document !== 'undefined' && document.getElementById(id);
  if (btn) btn.style.display = show ? '' : 'none';
}

// Wire the input-row undo/redo buttons and the branch-capture hook. Called once
// during boot (like initMicButton).
export function initTimeTravel() {
  onFork(captureFork);
  document.getElementById('undo-btn')?.addEventListener('click', () => undoLastTurn());
  document.getElementById('redo-btn')?.addEventListener('click', () => redoLastTurn());
}
