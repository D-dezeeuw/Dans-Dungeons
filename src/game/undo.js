// src/game/undo.js — single-step "undo last turn" via Spektrum time-travel.
//
// Every dungeon/combat turn is bracketed by a mark (a history index captured
// before the turn's writes) plus a tagged checkpoint for the serialized log.
// undoLastTurn() replays history to the last mark, reverting all appState the
// turn touched: room, NPCs, HP, transcript data, skill cooldowns, turn count.
//
// Spektrum's replay() re-fires every reactive binding against the rebuilt
// state, so the header stats (:innerHTML), action-bar word clouds (data-each),
// data-if visibility and the {{turn}} counter all refresh on their own. Only
// the two imperative surfaces — the transcript DOM and the compass — are
// redrawn here. The scene sketch lives in localStorage (not appState/history),
// so it is intentionally left untouched.
//
// Marks are in-memory only: a reload (resume, /restart) starts with none, and
// clearTurnMarks() drops them when a fresh game begins in the same session so
// an undo can never cross a game boundary into stale history.

import { appState, setValue, replay, checkpoint, spektrumHistory, saveToStorage } from '../core/state.js';
import { rebuildTranscript } from '../ui/transcript.js';
import { updateActionBar }   from '../ui/actionbar.js';

// History indices, one per undoable turn. The top is the most recent turn.
const _marks = [];

// Bracket a turn: record the pre-turn history index, drop a checkpoint marker,
// then expose the undo affordance. The `ui.canUndo` write lands AFTER the mark
// is captured, so replaying to the mark excludes it (state stays coherent).
export function markTurn(label) {
  _marks.push(spektrumHistory.length);
  checkpoint(label);
  setValue('ui.canUndo', true);
}

// Roll back the most recent marked turn. Returns false when nothing is undoable.
// Refuses to run mid-turn: the command input is disabled while a turn is being
// processed, and replaying then would race the in-flight commit. Undo is only
// safe between turns, when the engine is idle awaiting the next input.
function undoLastTurn() {
  if (!_marks.length) return false;
  if (document.getElementById('cmd')?.disabled) return false;
  const mark = _marks.pop();
  replay(mark);                              // reactive bindings re-fire automatically
  rebuildTranscript();                       // transcript DOM is imperative — redraw it
  redrawCompass();                           // compass is imperative — redraw for the reverted room
  setValue('ui.canUndo', _marks.length > 0);
  saveToStorage();
  return true;
}

// Forget every mark (new game in the same session). Hides the undo button.
export function clearTurnMarks() {
  _marks.length = 0;
  setValue('ui.canUndo', false);
}

function redrawCompass() {
  if (!appState.settings?.actionBar) return;
  const roomId = appState.world?.currentRoom;
  const exits  = appState.world?.rooms?.[roomId]?.exits ?? [];
  updateActionBar(exits);
}

// Wire the input-row undo button. Called once during boot (like initMicButton).
export function initUndoButton() {
  const btn = document.getElementById('undo-btn');
  if (btn) btn.addEventListener('click', () => undoLastTurn());
}
