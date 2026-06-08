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
// DIVERGENCE — issuing a NEW turn while scrubbed back (`_pos` not at the head)
// discards the now-stale redo stops here, while Spektrum forks the abandoned
// history tail onto `forks` (Phase 2 surfaces those as navigable branches).
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

import { appState, replay, checkpoint, spektrumHistory, saveToStorage } from '../core/state.js';
import { rebuildTranscript } from '../ui/transcript.js';
import { updateActionBar }   from '../ui/actionbar.js';

// Turn-boundary history indices for the current epoch (ascending). `_pos` is the
// index into `_stops` of the state we are currently sitting at; `_epochSig` is
// the context signature shared by every stop in this epoch.
let _stops    = [];
let _pos      = 0;
let _epochSig = null;

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

// Shared scrub: replay to a stop, redraw the imperative surfaces, refresh the
// buttons, persist. No recorded writes happen here (see the file header).
function scrubTo(index) {
  replay(index);            // reactive bindings re-fire automatically
  rebuildTranscript();      // transcript DOM is imperative — redraw it
  redrawCompass();          // compass is imperative — redraw for the reverted room
  refreshButtons();
  saveToStorage();
}

// Forget the whole timeline (new game, or a play-context transition). Hides both
// buttons.
export function clearTurnMarks() {
  _stops    = [];
  _pos      = 0;
  _epochSig = null;
  refreshButtons();
}

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

// Wire the input-row undo/redo buttons. Called once during boot (like
// initMicButton).
export function initTimeTravel() {
  document.getElementById('undo-btn')?.addEventListener('click', () => undoLastTurn());
  document.getElementById('redo-btn')?.addEventListener('click', () => redoLastTurn());
}
